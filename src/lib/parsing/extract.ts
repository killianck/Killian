// Extraction heuristique des informations d'une facture à partir de son TEXTE.
//
// Ces fonctions sont volontairement "pures" (texte -> données) pour pouvoir être
// testées facilement, indépendamment de la lecture du PDF.
//
// ⚠️ L'extraction automatique n'est jamais fiable à 100 % : le résultat doit
//    toujours être vérifié par l'utilisateur.

import type { ParsedInvoice, ParsedVatLine } from "./types";
import { findMoneyTokens, parseFrAmount } from "./frenchNumbers";
import { round2 } from "@/lib/tva/rules";

/** Enlève les accents pour comparer les mots-clés sans se soucier de la casse. */
const COMBINING_MARKS = /[̀-ͯ]/g;
const deburr = (s: string) => s.normalize("NFD").replace(COMBINING_MARKS, "").toLowerCase();

const MONTHS_FR: Record<string, number> = {
  janvier: 1, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6,
  juillet: 7, aout: 8, septembre: 9, octobre: 10, novembre: 11, decembre: 12,
};

// ---------------------------------------------------------------------------
//  Dates
// ---------------------------------------------------------------------------

function toIso(day: number, month: number, year: number): string | undefined {
  if (year < 100) year += year < 70 ? 2000 : 1900;
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1990 || year > 2100) return undefined;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Toutes les dates d'une ligne (format JJ/MM/AAAA ou "15 août 2026"). */
export function datesInLine(line: string): string[] {
  const out: string[] = [];
  const numeric = /\b(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})\b/g;
  let m: RegExpExecArray | null;
  while ((m = numeric.exec(line))) {
    const iso = toIso(Number(m[1]), Number(m[2]), Number(m[3]));
    if (iso) out.push(iso);
  }
  const textual = /\b(\d{1,2})\s+([A-Za-zÀ-ÿ]+)\s+(\d{4})\b/g;
  while ((m = textual.exec(line))) {
    const month = MONTHS_FR[deburr(m[2])];
    if (month) {
      const iso = toIso(Number(m[1]), month, Number(m[3]));
      if (iso) out.push(iso);
    }
  }
  return out;
}

export function extractDates(text: string): { invoiceDate?: string; dueDate?: string } {
  const lines = text.split(/\r?\n/);
  let invoiceDate: string | undefined;
  let dueDate: string | undefined;

  const DUE = /(echeance|date limite|a regler (avant|le)|payable (le|avant)|reglement (avant|au|le)|a payer (avant|le)|date de (reglement|paiement)|paiement (au|le))/;
  const INVOICE = /(date de facture|date facture|date d.?emission|date d.?edition|emise? le|edite le|fait le|^date\b|date\s*:)/;
  const OTHER = /(livraison|commande|prestation|periode|reception|expedi)/;

  for (let i = 0; i < lines.length; i++) {
    const d = deburr(lines[i]);
    const dates = datesInLine(lines[i]);
    // date sur la même ligne, ou sur la ligne suivante si la ligne courante
    // n'est qu'un libellé ("Règlement au" \n "31/07/2026")
    const nextDates = dates.length ? dates : datesInLine(lines[i + 1] ?? "");

    if (DUE.test(d) && !dueDate && nextDates.length) dueDate = nextDates[0];
    else if (INVOICE.test(d) && !OTHER.test(d) && !invoiceDate && dates.length) invoiceDate = dates[0];
  }

  // À défaut : première date "raisonnable" du document = date de facture
  if (!invoiceDate) {
    for (const line of lines) {
      const dates = datesInLine(line);
      if (dates.length) {
        invoiceDate = dates[0];
        break;
      }
    }
  }

  // Termes "à réception" / "comptant" => échéance = date de facture
  if (!dueDate && /(a reception|comptant|paiement immediat|des reception)/.test(deburr(text)) && invoiceDate) {
    dueDate = invoiceDate;
  }

  return { invoiceDate, dueDate };
}

// ---------------------------------------------------------------------------
//  Identité du document
// ---------------------------------------------------------------------------

export function extractDocumentType(text: string): "facture" | "avoir" {
  const head = deburr(text.slice(0, 600));
  if (/\bavoir\b/.test(head) || /note de credit/.test(head) || /facture d.?avoir/.test(deburr(text))) {
    return "avoir";
  }
  return "facture";
}

const NUMBER_BLOCKLIST = /^(mail|https?|www|tel|fax|iban|bic|siret|siren|tva|rcs|ape|naf|du|le|de|la|the|client|date|page|ref|n[o°º]|vat|number|facture|invoice|avoir)$/i;

export function extractInvoiceNumber(text: string): string | undefined {
  const patterns = [
    /\bn[o°º]\s*(?:de\s+)?facture\s*[:.]?\s*([A-Za-z0-9][A-Za-z0-9/\-_.]{3,20})/i,
    /\bfacture\s*n[o°º]\s*[:.]?\s*([A-Za-z0-9][A-Za-z0-9/\-_.]{3,20})/i,
    /\b(?:facture|avoir|invoice)\s*(?:n[o°º]|number|#)?\s*[:.]?\s*([A-Za-z0-9][A-Za-z0-9/\-_.]{3,20})/i,
    /\bn[o°º]\s*[:.]?\s*([A-Za-z0-9][A-Za-z0-9/\-_.]{4,20})/i,
    /\bref(?:erence)?\s*[:.]?\s*([A-Za-z0-9][A-Za-z0-9/\-_.]{3,20})/i,
  ];
  const isDate = /^\d{1,2}[/.\-]\d{1,2}[/.\-]\d{2,4}$/;
  for (const re of patterns) {
    for (const m of text.matchAll(new RegExp(re, "gi"))) {
      const v = m[1].replace(/[.,;:]+$/, "").trim();
      if (v && !NUMBER_BLOCKLIST.test(v) && /\d/.test(v) && !isDate.test(v)) return v;
    }
  }
  return undefined;
}

export function extractSiret(text: string): string | undefined {
  const m = deburr(text).match(/siret\s*[:.]?\s*((?:\d[\s.]?){14})/);
  if (m) {
    const digits = m[1].replace(/\D/g, "");
    if (digits.length === 14) return digits;
  }
  const loose = text.match(/\b(\d{3}\s?\d{3}\s?\d{3}\s?\d{5})\b/);
  if (loose) {
    const digits = loose[1].replace(/\D/g, "");
    if (digits.length === 14) return digits;
  }
  return undefined;
}

export function extractVatNumber(text: string): string | undefined {
  const m = text.match(/\bFR\s?[0-9A-Z]{2}\s?\d{3}\s?\d{3}\s?\d{3}\b/i);
  return m ? m[0].replace(/\s/g, "").toUpperCase() : undefined;
}

export function extractCurrency(text: string): string {
  if (/€|\beur\b/i.test(text)) return "EUR";
  if (/\$|\busd\b/i.test(text)) return "USD";
  if (/£|\bgbp\b/i.test(text)) return "GBP";
  if (/\bchf\b/i.test(text)) return "CHF";
  return "EUR";
}

const ORG_SUFFIX = /\b(SARL|SASU|SAS|EURL|SCI|SA|EI|SNC|SCOP|Sàrl|S\.A\.S\.?|S\.A\.R\.L\.?)\b/i;

export function extractSupplier(text: string): string | undefined {
  // 1) Une ligne du type "MA SOCIÉTÉ SARL"
  for (const line of text.split(/\r?\n/).slice(0, 12)) {
    const m = line.match(new RegExp(`([A-Za-zÀ-ÿ0-9][\\w &'.\\-À-ÿ]{1,55}?${ORG_SUFFIX.source})\\b`, "i"));
    if (m && !/facture|facture?e a|livre a/i.test(m[1])) return m[1].trim();
  }
  // 2) À défaut : la première ligne significative (souvent l'en-tête du vendeur)
  for (const raw of text.split(/\r?\n/).slice(0, 6)) {
    const line = raw.trim();
    if (line.length < 3) continue;
    if (/^(facture|devis|avoir|invoice|bon de|page\b)/i.test(line)) continue;
    if (!/[A-Za-zÀ-ÿ]{3}/.test(line)) continue;
    const name = line.split(/\s[-–—]\s|\s{2,}|,| tel| tél|\d{2,}/i)[0].trim();
    if (name.length >= 3 && name.length <= 60) return name;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
//  Montants
// ---------------------------------------------------------------------------

const KW = {
  ht: /(total|montant|base|sous.?total)\s*h\.?\s?t\.?\b|total\s+hors\s+taxe|\bht\s*[:=]/,
  ttc: /(total|montant|net)\s*(t\.?\s?t\.?c\.?|a\s+payer|du|net)\b|toutes taxes comprises|net a payer|\bttc\s*[:=]/,
  // "Total TVA", "Montant TVA", "TVA :", ou une ligne de récap "TVA 20 % ..."
  tva: /(total|montant)\s*(de\s+)?(la\s+)?t\.?\s?v\.?\s?a\.?\b|\bt\.?\s?v\.?\s?a\.?\s*[:=]|\bt\.?\s?v\.?\s?a\.?\s*\(?\s*\d{1,2}([.,]\d{1,2})?\s*%/,
};

/** Dernier montant d'une ligne (les montants sont souvent alignés à droite). */
function lastMoney(line: string): number | undefined {
  const tokens = findMoneyTokens(line);
  return tokens.length ? tokens[tokens.length - 1] : undefined;
}

/** Valeur la plus fréquente d'une liste (sinon la plus grande). */
function mostFrequent(values: number[]): number {
  const count = new Map<number, number>();
  for (const v of values) count.set(v, (count.get(v) ?? 0) + 1);
  let best = values[0];
  let bestN = 0;
  for (const [v, n] of count) {
    if (n > bestN || (n === bestN && v > best)) {
      best = v;
      bestN = n;
    }
  }
  return best;
}

export type ExtractedAmounts = {
  totalHT?: number;
  totalVAT?: number;
  totalTTC?: number;
  vatLines: ParsedVatLine[];
  rates: number[];
  notes: string[];
};

export function extractAmounts(text: string): ExtractedAmounts {
  const lines = text.split(/\r?\n/);
  const notes: string[] = [];

  // Taux de TVA présents dans le document
  const rates = [
    ...new Set(
      (text.match(/(?<![\d.,])(\d{1,2}(?:[.,]\d{1,2})?)\s*%/g) ?? [])
        .map((r) => parseFrAmount(r.replace("%", "")))
        .filter((n): n is number => n !== null && n >= 0 && n <= 30),
    ),
  ];
  const nonZeroRates = rates.filter((r) => r > 0);
  const isRateValue = (v: number) => rates.some((r) => Math.abs(r - v) < 0.001);

  let totalHT: number | undefined;
  let totalVAT: number | undefined;
  let totalTTC: number | undefined;
  const ttcCandidates: number[] = [];
  const htCandidates: number[] = [];
  const vatCandidates: number[] = [];

  for (const raw of lines) {
    const d = deburr(raw);
    if (/intracommunautaire|numero de tva|n[o°]\s*tva|identification t\.?v\.?a/.test(d)) continue;
    const tokens = findMoneyTokens(raw).filter((v) => !isRateValue(v));
    if (!tokens.length) continue;

    if (KW.ttc.test(d)) ttcCandidates.push(...tokens);
    else if (KW.tva.test(d)) vatCandidates.push(Math.max(...tokens));
    else if (KW.ht.test(d)) htCandidates.push(tokens[tokens.length - 1]);
  }

  if (ttcCandidates.length) totalTTC = Math.max(...ttcCandidates);
  if (vatCandidates.length) totalVAT = Math.max(...vatCandidates);
  if (htCandidates.length) totalHT = mostFrequent(htCandidates);

  // Filet de sécurité : une ligne "Total ... montant" en bas de page
  if (totalTTC === undefined) {
    for (let i = lines.length - 1; i >= 0 && i > lines.length - 15; i--) {
      const d = deburr(lines[i]);
      if (/\btotal\b/.test(d) && !KW.ht.test(d) && !KW.tva.test(d)) {
        const m = lastMoney(lines[i]);
        if (m !== undefined) { totalTTC = m; break; }
      }
    }
  }

  // Complétion par calcul si un seul montant manque
  const known = [totalHT, totalVAT, totalTTC].filter((v) => v !== undefined).length;
  if (known === 2) {
    if (totalHT === undefined && totalTTC !== undefined && totalVAT !== undefined) {
      totalHT = round2(totalTTC - totalVAT);
      notes.push("Total HT calculé (TTC − TVA).");
    } else if (totalVAT === undefined && totalTTC !== undefined && totalHT !== undefined) {
      totalVAT = round2(totalTTC - totalHT);
      notes.push("Montant de TVA calculé (TTC − HT).");
    } else if (totalTTC === undefined && totalHT !== undefined && totalVAT !== undefined) {
      totalTTC = round2(totalHT + totalVAT);
      notes.push("Total TTC calculé (HT + TVA).");
    }
  }

  // Taux déduit du rapport TVA / HT si aucun taux clair n'a été lu
  // (tolérance de 0,5 point pour absorber les arrondis).
  let inferredRate: number | undefined;
  if (!nonZeroRates.length && totalHT && totalVAT) {
    const raw = (totalVAT / totalHT) * 100;
    inferredRate = [20, 10, 5.5, 2.1].find((r) => Math.abs(r - raw) <= 0.5);
  }

  // Lignes de TVA
  let vatLines: ParsedVatLine[] = [];
  if (nonZeroRates.length === 1 && totalHT !== undefined && totalVAT !== undefined) {
    vatLines = [{ rate: nonZeroRates[0], baseHT: totalHT, vatAmount: totalVAT }];
  } else if (inferredRate !== undefined && totalHT !== undefined && totalVAT !== undefined) {
    vatLines = [{ rate: inferredRate, baseHT: totalHT, vatAmount: totalVAT }];
  } else if (nonZeroRates.length === 0 && totalHT !== undefined && (totalVAT ?? 0) === 0) {
    vatLines = [{ rate: 0, baseHT: totalHT, vatAmount: 0 }];
  } else if (nonZeroRates.length > 1) {
    const found: ParsedVatLine[] = [];
    for (const raw of lines) {
      const rateMatch = raw.match(/(\d{1,2}(?:[.,]\d{1,2})?)\s*%/);
      if (!rateMatch) continue;
      const rate = parseFrAmount(rateMatch[1]);
      if (rate === null || rate <= 0) continue;
      const tokens = findMoneyTokens(raw);
      if (tokens.length < 2) continue;
      // cherche (base, tva) tel que tva ≈ base * taux / 100
      for (let a = 0; a < tokens.length; a++) {
        for (let b = 0; b < tokens.length; b++) {
          if (a === b) continue;
          const expected = round2((tokens[a] * rate) / 100);
          if (Math.abs(expected - tokens[b]) <= Math.max(0.02, expected * 0.01)) {
            found.push({ rate, baseHT: tokens[a], vatAmount: tokens[b] });
          }
        }
      }
    }
    // déduplique par taux
    const byRate = new Map<number, ParsedVatLine>();
    for (const l of found) if (!byRate.has(l.rate)) byRate.set(l.rate, l);
    const candidate = [...byRate.values()];
    const sumHT = round2(candidate.reduce((s, l) => s + l.baseHT, 0));
    const sumVAT = round2(candidate.reduce((s, l) => s + l.vatAmount, 0));
    const okHT = totalHT === undefined || Math.abs(sumHT - totalHT) <= 0.05;
    const okVAT = totalVAT === undefined || Math.abs(sumVAT - totalVAT) <= 0.05;
    if (candidate.length >= 2 && okHT && okVAT) {
      vatLines = candidate;
      if (totalHT === undefined) totalHT = sumHT;
      if (totalVAT === undefined) totalVAT = sumVAT;
      if (totalTTC === undefined) totalTTC = round2(sumHT + sumVAT);
    } else {
      notes.push("Plusieurs taux de TVA détectés mais le détail par taux n'a pas pu être reconstitué de façon fiable.");
    }
  }

  return { totalHT, totalVAT, totalTTC, vatLines, rates: nonZeroRates, notes };
}

// ---------------------------------------------------------------------------
//  Assemblage
// ---------------------------------------------------------------------------

export function buildParsedInvoice(text: string, engine: string): ParsedInvoice {
  const clean = (text ?? "").replace(/ /g, " ");
  const warnings: string[] = [];

  if (clean.replace(/\s/g, "").length < 25) {
    return {
      confidence: 0,
      engine,
      warnings: [
        "Ce PDF ne contient pas de texte lisible (il s'agit probablement d'un scan ou d'une image). " +
          "Veuillez saisir les informations manuellement.",
      ],
    };
  }

  const { invoiceDate, dueDate } = extractDates(clean);
  const amounts = extractAmounts(clean);
  warnings.push(...amounts.notes);

  const documentType = extractDocumentType(clean);
  const number = extractInvoiceNumber(clean);
  const siret = extractSiret(clean);
  const vatNumber = extractVatNumber(clean);
  const currency = extractCurrency(clean);
  const partyName = extractSupplier(clean);

  if (!number) warnings.push("Numéro de facture non détecté.");
  if (!invoiceDate) warnings.push("Date de facture non détectée.");
  if (!dueDate) warnings.push("Date d'échéance non détectée (« Échéance non indiquée »).");
  if (amounts.totalHT === undefined) warnings.push("Total HT non détecté.");
  if (amounts.totalVAT === undefined) warnings.push("Montant de TVA non détecté.");
  if (amounts.totalTTC === undefined) warnings.push("Total TTC non détecté.");
  if (!partyName) warnings.push("Nom du fournisseur / client non détecté.");

  // Cohérence HT + TVA = TTC
  let coherent = false;
  if (amounts.totalHT !== undefined && amounts.totalVAT !== undefined && amounts.totalTTC !== undefined) {
    coherent = Math.abs(amounts.totalHT + amounts.totalVAT - amounts.totalTTC) <= 0.02;
    if (!coherent) warnings.push("Attention : HT + TVA ne correspond pas au TTC détecté. Vérifiez les montants.");
  }

  const score =
    (amounts.totalTTC !== undefined ? 0.4 : 0) +
    (amounts.totalHT !== undefined ? 0.2 : 0) +
    (amounts.totalVAT !== undefined ? 0.15 : 0) +
    (number ? 0.1 : 0) +
    (invoiceDate ? 0.1 : 0) +
    (coherent ? 0.05 : 0);

  return {
    documentType,
    number,
    invoiceDate,
    dueDate,
    partyName,
    siret,
    vatNumber,
    currency,
    totalHT: amounts.totalHT,
    totalVAT: amounts.totalVAT,
    totalTTC: amounts.totalTTC,
    vatLines: amounts.vatLines.length ? amounts.vatLines : undefined,
    confidence: Math.min(1, round2(score)),
    warnings,
    engine,
  };
}
