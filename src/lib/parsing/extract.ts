// Extraction heuristique des informations d'une facture à partir de son TEXTE.
//
// Ces fonctions sont volontairement "pures" (texte -> données) pour pouvoir être
// testées facilement, indépendamment de la lecture du PDF.
//
// ⚠️ RÈGLE FONDAMENTALE : ne JAMAIS inventer une valeur. En cas de doute, un
//    champ reste `undefined` (jamais 0 ni une valeur devinée présentée comme
//    sûre) et un avertissement l'explique. Chaque montant garde la trace de sa
//    PROVENANCE (lu / calculé / deviné) ; l'indice de confiance en tient compte.

import type { ParsedInvoice, ParsedVatLine } from "./types";
import { findMoneyTokens, parseFrAmount } from "./frenchNumbers";
import { detectStatement } from "./statement";
import { round2, EXTRACTION_VAT_RATES, isPlausibleVatRate } from "@/lib/tva/rules";

/** Enlève les accents pour comparer les mots-clés sans se soucier de la casse. */
const COMBINING_MARKS = /[̀-ͯ]/g;
export const deburr = (s: string) => s.normalize("NFD").replace(COMBINING_MARKS, "").toLowerCase();

const MONTHS_FR: Record<string, number> = {
  janvier: 1, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6,
  juillet: 7, aout: 8, septembre: 9, octobre: 10, novembre: 11, decembre: 12,
};

// ---------------------------------------------------------------------------
//  Dates
// ---------------------------------------------------------------------------

function toIso(day: number, month: number, year: number): string | undefined {
  if (year < 100) year += year < 70 ? 2000 : 1900;
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 2000 || year > 2100) return undefined;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Toutes les dates d'une ligne (format JJ/MM/AAAA ou "15 août 2026"). */
export function datesInLine(line: string): string[] {
  const out: string[] = [];
  const numeric = /(\d{1,2})([/.\-])(\d{1,2})\2(\d{4}|\d{2})\b/g;
  let m: RegExpExecArray | null;
  while ((m = numeric.exec(line))) {
    const [, a, sep, b, y] = m;
    // « 3.1.2026 » (jour + mois à 1 chiffre, séparateur point ou tiret, année à
    // 4 chiffres) ressemble bien plus à un numéro de version qu'à une date.
    if (sep !== "/" && a.length === 1 && b.length === 1 && y.length === 4) continue;
    const iso = toIso(Number(a), Number(b), Number(y));
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

/**
 * Une date de facture est-elle plausible ? On accepte largement (comptabilité
 * en retard) mais on écarte l'absurde : > 45 j dans le futur, ou > 5 ans dans
 * le passé (ex. « signé le 04/09/2018 » pris pour la date de facture).
 */
function isPlausibleInvoiceDate(iso: string, today = new Date()): boolean {
  const d = new Date(iso + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return false;
  const now = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const DAY = 86_400_000;
  return d.getTime() <= now + 45 * DAY && d.getTime() >= now - 1826 * DAY;
}

export type ExtractedDates = { invoiceDate?: string; dueDate?: string; notes: string[] };

export function extractDates(text: string): ExtractedDates {
  const stripped = stripBoilerplate(text);
  const lines = stripped.split(/\r?\n/);
  const notes: string[] = [];
  let invoiceDate: string | undefined;
  let dueDate: string | undefined;

  const DUE = /(echeance|\bech\b|date limite|a regler (avant|le)|payable (le|avant)|reglement (avant|au|le)|a payer (avant|le)|date de (reglement|paiement)|paiement (au|le))/;
  const INVOICE = /(date de facture|date facture|date d.?emission|date d.?edition|emise? le|edite le|fait le|facture du|^date\b|date\s*:)/;
  const OTHER = /(livraison|commande|prestation|periode|reception|expedi|creee? le|inscription|immatricul|\bbl\b|bon de|contrat|signe)/;

  // Motif « N° <num> du JJ/MM/AAAA » (ou « Facture … du … ») = date de facture,
  // sauf s'il s'agit d'une livraison / commande / BL.
  const NUM_DU_DATE = /(facture|\bn[o°º]\s*[a-z]*\d)[^\n]{0,30}\bdu\s+\d{1,2}[/.]\d{1,2}[/.]\d{2,4}/;

  for (let i = 0; i < lines.length; i++) {
    const d = deburr(lines[i]);
    const prevD = deburr(lines[i - 1] ?? "");
    const dates = datesInLine(lines[i]);
    const nextDates = dates.length ? dates : datesInLine(lines[i + 1] ?? "");

    if (DUE.test(d) && !dueDate && nextDates.length && isPlausibleInvoiceDate(nextDates[0])) {
      dueDate = nextDates[0];
    } else if (
      !invoiceDate && dates.length &&
      ((INVOICE.test(d) && !OTHER.test(d)) ||
        (NUM_DU_DATE.test(d) && !OTHER.test(d)) ||
        (/^facture$/.test(prevD.trim()) && /\bdu\s+\d/.test(d)))
    ) {
      invoiceDate = dates[0];
    }
  }

  // À défaut : première date "plausible" du document = date de facture, MAIS on
  // le signale (c'est une supposition, pas une lecture fiable).
  if (!invoiceDate) {
    for (const line of lines) {
      const candidate = datesInLine(line).find((iso) => isPlausibleInvoiceDate(iso));
      if (candidate) {
        invoiceDate = candidate;
        notes.push(
          "Date de facture non libellée : première date plausible du document retenue — à vérifier impérativement.",
        );
        break;
      }
    }
  }

  if (invoiceDate && !isPlausibleInvoiceDate(invoiceDate)) {
    notes.push(`Date de facture détectée (${invoiceDate}) inhabituelle — à vérifier.`);
  }
  if (invoiceDate && dueDate && dueDate < invoiceDate) {
    notes.push("La date d'échéance précède la date de facture — à vérifier.");
  }

  if (!dueDate && /(a reception|comptant|paiement immediat|des reception)/.test(deburr(stripped)) && invoiceDate) {
    dueDate = invoiceDate;
  }

  return { invoiceDate, dueDate, notes };
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

/**
 * Lignes de « bas de page » juridiques (conditions générales, loi, pénalités…).
 * On ne retire une ligne QUE si elle ne porte aucun montant NI mot-clé de total :
 * une vraie ligne de totaux contenant le mot « article » ou « escompte » doit
 * être conservée.
 */
const BOILERPLATE_STRONG =
  /(conditions?\s+generales|reserve de propriete|\bc\.?g\.?v\.?\b|tribunal|seul competent|indemnite forfaitaire|nos factures sont payables|penalit(e|es|es de retard)|taux de penalite|\bloi\s+n|\bdecret\b|\barrete\s+(du|ministeriel)|ministeriel|escompte|frais de recouvrement|reglement (posterieur|a l.?echeance)|mentions? legales|code de commerce|pas d.?escompte|\brcs\b|greffe)/;
const BOILERPLATE_HEAD = /^\s*(article\s+l\.?\s?\d)/;

const TOTAL_KW_ANY = /(total|montant|\bht\b|\bttc\b|\btva\b|\bt\.v\.a|net a payer|a payer|toutes taxes|base|taxe)/;

/** Retire les lignes de bas de page juridiques (sans jamais perdre un montant). */
export function stripBoilerplate(text: string): string {
  return text
    .split(/\r?\n/)
    .filter((line) => {
      const d = deburr(line);
      if (BOILERPLATE_HEAD.test(d)) return false;
      if (!BOILERPLATE_STRONG.test(d)) return true;
      // ligne « juridique » : on ne la retire que si elle ne contient ni montant
      // ni mot-clé de total (sinon c'est peut-être une vraie ligne de totaux).
      return findMoneyTokens(line).length > 0 && TOTAL_KW_ANY.test(d);
    })
    .join("\n");
}

const NUMBER_TOKEN = /^[A-Za-z]{0,5}\d[A-Za-z0-9/\-_.]{2,20}$/;
/** Un « numéro » qui n'est en fait qu'un nombre décimal (montant, référence de loi…). */
const LOOKS_NUMERIC = /^\d{1,3}([.,]\d{1,3})+$/;
/** Contextes qui ne sont PAS un numéro de facture (bon de commande client, devis…). */
const NOT_INVOICE_NUM_CONTEXT = /(commande|bon de commande|\bb\.?c\.?\b|devis|votre (ref|reference|commande)|client|contrat|dossier)/;

export function extractInvoiceNumber(input: string): string | undefined {
  const text = stripBoilerplate(input);
  const isDate = /^(\d{1,2}[/.\-]\d{1,2}[/.\-]\d{2,4}|\d{4}-\d{2}-\d{2})$/;
  const ok = (v: string) =>
    v && !NUMBER_BLOCKLIST.test(v) && /\d/.test(v) && !isDate.test(v) && !LOOKS_NUMERIC.test(v);

  // On priorise les libellés explicites « n° facture » / « facture n° ».
  const strong = [
    /\bn[o°º]\s*(?:de\s+)?facture\s*[:.]?\s*([A-Za-z0-9][A-Za-z0-9/\-_.]{2,20})/i,
    /\bfacture\s*(?:n[o°º]|#)\s*[:.]?\s*([A-Za-z0-9][A-Za-z0-9/\-_.]{2,20})/i,
  ];
  const weak = [
    /\b(?:facture|avoir|invoice)\s*(?:n[o°º]|number|#)?\s*[:.]?\s*([A-Za-z0-9][A-Za-z0-9/\-_.]{3,20})/i,
    /\bn[o°º]\s*[:.]?\s*([A-Za-z0-9][A-Za-z0-9/\-_.]{4,20})/i,
    /\bref(?:erence)?\s*[:.]?\s*([A-Za-z0-9][A-Za-z0-9/\-_.]{3,20})/i,
  ];

  const tryPatterns = (patterns: RegExp[], guardContext: boolean) => {
    for (const re of patterns) {
      for (const m of text.matchAll(new RegExp(re, "gi"))) {
        if (guardContext) {
          const around = deburr(text.slice(Math.max(0, m.index - 40), m.index + 10));
          if (NOT_INVOICE_NUM_CONTEXT.test(around)) continue;
        }
        const v = m[1].replace(/[.,;:]+$/, "").trim();
        if (ok(v)) return v;
      }
    }
    return undefined;
  };

  const fromStrong = tryPatterns(strong, false);
  if (fromStrong) return fromStrong;

  // Mise en page « en-tête de tableau » : le libellé (« Facture N° ») est sur une
  // ligne et la valeur sur la ligne suivante (« FAT000546  08/06/2026 »).
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length - 1; i++) {
    const d = deburr(lines[i]);
    if (!/\b(facture|avoir|invoice)\b/.test(d) || !/\bn[o°º]/.test(d)) continue;
    if (findMoneyTokens(lines[i]).length) continue;
    for (const tok of lines[i + 1].trim().split(/\s+/)) {
      const v = tok.replace(/[.,;:]+$/, "");
      if (NUMBER_TOKEN.test(v) && ok(v) && /[A-Za-z]/.test(v)) return v;
    }
  }

  return tryPatterns(weak, true);
}

// Marqueur d'un bloc « client / destinataire » : un SIRET / n° TVA qui apparaît
// dans les lignes qui suivent est celui du CLIENT, pas du fournisseur.
const CLIENT_MARKER = /(^|\s)(client\b|adresse (de )?facturation|facturation\s*[:.]|facture(r|z)? a\b|adressee? a\b|livre a\b|livraison\s*[:.]|destinataire|expedier a\b|bill to|ship to|sold to)/;
/**
 * Marqueur « mentions légales du fournisseur » : ces mots figurent dans le pied
 * de page obligatoire de l'émetteur, jamais dans un bloc « facturé à … ». Un
 * SIRET / n° TVA sur une telle ligne est celui du FOURNISSEUR.
 */
const SUPPLIER_MARKER = /(au capital de|capital de|\biban\b|\bbic\b|\brcs\b|\bsiren\b|intracommunautaire|siege social|\bape\b|\bnaf\b|r\.?c\.?s\.?\s)/;

/**
 * Choisit, parmi plusieurs correspondances (SIRET, n° TVA…), celle du FOURNISSEUR.
 * `perLine` renvoie `{ value, labelled }` — `labelled` = la valeur était précédée
 * de son libellé (« SIRET : … »), signe fort. Priorité :
 *   1. ligne portant une mention légale d'émetteur (capital / RCS / IBAN /
 *      « TVA intracommunautaire »…) ;
 *   2. à défaut, valeur libellée hors d'un bloc « client / livré à … » ;
 *   3. à défaut, la première rencontrée.
 */
function pickSupplierMatch(
  text: string,
  perLine: (line: string) => { value: string; labelled: boolean } | null,
): string | undefined {
  const lines = text.split(/\r?\n/);
  let sinceClient = 99; // nb de lignes depuis le dernier marqueur « client »
  let best: { value: string; rank: number } | undefined;
  for (let i = 0; i < lines.length; i++) {
    const d = deburr(lines[i]);
    const legal = SUPPLIER_MARKER.test(d);
    if (CLIENT_MARKER.test(d)) sinceClient = 0;
    else if (legal) sinceClient = 99;
    else sinceClient++;

    const hit = perLine(lines[i]);
    if (!hit) continue;
    const inClient = !legal && sinceClient <= 8;
    // rang : mention légale (6/7) > libellé neutre (4/5) > bloc client (0/1),
    //        +1 quand la valeur est libellée.
    const rank = (legal ? 6 : inClient ? 0 : 4) + (hit.labelled ? 1 : 0);
    if (!best || rank > best.rank) best = { value: hit.value, rank };
  }
  return best?.value;
}

export function extractSiret(text: string): string | undefined {
  return pickSupplierMatch(text, (line) => {
    const labelled = deburr(line).match(/siret\s*[:.]?\s*((?:\d[\s.]?){14})/);
    if (labelled) {
      const d = labelled[1].replace(/\D/g, "");
      if (d.length === 14) return { value: d, labelled: true };
    }
    const bare = line.match(/\b\d{3}\s?\d{3}\s?\d{3}\s?\d{5}\b/);
    const d = bare?.[0].replace(/\D/g, "");
    return d && d.length === 14 ? { value: d, labelled: false } : null;
  });
}

export function extractVatNumber(text: string): string | undefined {
  return pickSupplierMatch(text, (line) => {
    const m = line.match(/\bFR\s?[0-9A-Z]{2}\s?\d{3}\s?\d{3}\s?\d{3}\b/i);
    const v = m?.[0].replace(/\s/g, "").toUpperCase();
    if (!v || !/^FR[0-9A-Z]{2}\d{9}$/.test(v)) return null;
    const labelled = /(t\.?v\.?a\.?|tva|vat)/i.test(line.slice(0, Math.max(0, (m?.index ?? 0))));
    return { value: v, labelled };
  });
}

export function extractCurrency(text: string): { currency: string; ambiguous: boolean } {
  const t = stripBoilerplate(text);
  const eur = (t.match(/€|\beur\b/gi) ?? []).length;
  const usd = (t.match(/\$|\busd\b/gi) ?? []).length;
  const gbp = (t.match(/£|\bgbp\b/gi) ?? []).length;
  const chf = (t.match(/\bchf\b/gi) ?? []).length;
  const max = Math.max(eur, usd, gbp, chf);
  if (max === 0) return { currency: "EUR", ambiguous: false };
  const ambiguous = [eur, usd, gbp, chf].filter((n) => n > 0).length > 1;
  if (usd === max) return { currency: "USD", ambiguous };
  if (gbp === max) return { currency: "GBP", ambiguous };
  if (chf === max) return { currency: "CHF", ambiguous };
  return { currency: "EUR", ambiguous };
}

const ORG_SUFFIX = /\b(SARL|SASU|SAS|EURL|SCI|SA|EI|SNC|SCOP|Sàrl|S\.A\.S\.?|S\.A\.R\.L\.?)\b/i;
/** Fournisseurs d'e-mail / hébergeurs génériques : pas un nom d'entreprise. */
const GENERIC_DOMAIN = /^(gmail|outlook|hotmail|yahoo|orange|wanadoo|free|sfr|laposte|icloud|live|msn|proton)$/i;
/** Un « nom » qui n'est en fait qu'un fragment de numéro de facture. */
const NAME_STUB = /^[A-Za-z]{2,5}\d/;

const CLIENT_BLOCK = /\b(client|facturation|facture(r|z)? a|adresse (de )?facturation|livre a|livraison|destinataire|adresse de livraison|expedier a|bill to|ship to)\b/;
/** Ligne qui appartient visiblement à une ADRESSE (pas un nom d'entreprise). */
const ADDRESS_LINE =
  /^\d{1,4}\s|^\d{4,5}\s+[a-zà-ÿ]|\bcedex\b|^(france|belgique|luxembourg|suisse|allemagne|espagne|italie|portugal|pays-bas|royaume-uni|monaco)$/;

export function extractSupplier(text: string): string | undefined {
  const lines = text.split(/\r?\n/);
  const inClientBlock = (i: number) =>
    [1, 2, 3, 4, 5, 6].some((k) => CLIENT_BLOCK.test(deburr(lines[i - k] ?? "")));

  // 1) Ligne « … SARL / SAS / … » hors bloc client.
  for (let i = 0; i < Math.min(lines.length, 40); i++) {
    if (inClientBlock(i) || CLIENT_BLOCK.test(deburr(lines[i]))) continue;
    const m = lines[i].match(new RegExp(`([A-Za-zÀ-ÿ0-9][\\w &'.\\-À-ÿ]{1,55}?${ORG_SUFFIX.source})\\b`, "i"));
    if (m && !/factur|livre a|client|capital|www\.|https?:|@|\.(fr|com|net|eu)\b/i.test(deburr(m[1]))) {
      return m[1].trim().replace(/\s+/g, " ");
    }
  }

  // 2) Première ligne « significative » de l'en-tête (hors bloc client, hors adresse).
  for (let i = 0; i < Math.min(lines.length, 8); i++) {
    const line = lines[i].trim();
    if (line.length < 4 || inClientBlock(i)) continue;
    const dl = deburr(line);
    if (/^(facture|devis|avoir|invoice|bon de|page\b|client|facturation|livraison|repere|date\b|contact|mail|tel|siret|id\.?tva|incoterm)/.test(dl)) continue;
    if (ADDRESS_LINE.test(dl)) continue;
    if (!/[A-Za-zÀ-ÿ]{3}/.test(line)) continue;
    const name = line.split(/\s[-–—]\s|\s{2,}|,| tel| tél/i)[0].trim();
    if (name.length >= 4 && name.length <= 60 && !NAME_STUB.test(name) && !/\d{2,}/.test(name)) {
      return name;
    }
  }

  // 3) À défaut : domaine d'un e-mail / site web (souvent le seul endroit où
  //    figure le fournisseur quand son en-tête est un logo).
  const domains = [
    ...text.matchAll(/[\w.+-]+@([a-z0-9-]+)\.[a-z.]{2,}/gi),
    ...text.matchAll(/\bwww\.([a-z0-9-]+)\.[a-z.]{2,}/gi),
  ]
    .map((m) => m[1].toLowerCase())
    .filter((d) => d.length >= 3 && !GENERIC_DOMAIN.test(d));
  if (domains.length) {
    const d = domains.sort((a, b) => domains.filter((x) => x === b).length - domains.filter((x) => x === a).length)[0];
    return d.charAt(0).toUpperCase() + d.slice(1);
  }
  return undefined;
}

// ---------------------------------------------------------------------------
//  Montants
// ---------------------------------------------------------------------------

const KW = {
  ht: /(total|montant|base|sous.?total)\s*h\.?\s?t\.?\b|total\s+hors\s+taxe|\bht\s*[:=]|base\s+(?:hors\s+taxe|ht)/,
  ttc: /(total|montant|net|reste)\s*(t\.?\s?t\.?c\.?|a\s+payer|du|net|a\s+regler)\b|toutes taxes comprises|net a payer|montant du|\bttc\s*[:=]/,
  // "Total TVA", "Montant TVA", "TVA :", ou une ligne de récap "TVA 20 % ..."
  tva: /(total|montant)\s*(de\s+)?(la\s+)?t\.?\s?v\.?\s?a\.?\b|\bt\.?\s?v\.?\s?a\.?\s*[:=]|\bt\.?\s?v\.?\s?a\.?\s*\(?\s*\d{1,2}([.,]\d{1,2})?\s*%/,
};
/** Un libellé qui décrit une BASE, pas un montant de taxe. */
const KW_IS_BASE = /(base|montant\s+ht|assiette|ht\s+soumis|soumis a (la )?tva)/;

/** Provenance d'un montant : influe fortement sur la confiance. */
type Provenance = "observed" | "table" | "computed" | "guessed";

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

/** Taux « plausible » le plus proche du ratio vat/ht (tolérance stricte : 0,15 pt). */
function impliedStandardRate(vat: number, ht: number): number | undefined {
  if (ht <= 0 || vat < 0) return undefined;
  const r = (vat / ht) * 100;
  return EXTRACTION_VAT_RATES.find((s) => Math.abs(s - r) <= 0.15);
}

/**
 * Cherche, sur une même ligne, un triplet (HT, TVA, TTC) cohérent :
 *   HT + TVA ≈ TTC   et   TVA / HT ≈ un taux de TVA standard,
 * ET le TTC est RÉELLEMENT présent sur la ligne (pas seulement calculé),
 * OU la ligne porte un mot-clé de total (HT / TVA / TTC / net à payer).
 * C'est le cas des tableaux de totaux où libellés et valeurs sont sur des
 * lignes différentes. Renvoie le meilleur candidat, ou undefined.
 */
function bestCoherentTriple(
  lines: string[],
  isRateValue: (v: number) => boolean,
): { ht: number; vat: number; ttc: number; observedTtc: boolean } | undefined {
  type Cand = { ht: number; vat: number; ttc: number; observedTtc: boolean; score: number };
  let best: Cand | undefined;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const d = deburr(raw);
    if (/intracommunautaire|n[o°]\s*tva|iban|siret|\brib\b/.test(d)) continue;
    const hasTotalKw = KW.ht.test(d) || KW.tva.test(d) || KW.ttc.test(d);
    // Ligne de VALEURS juste sous une ligne de LIBELLÉS de totaux ?
    const prev = deburr(lines[i - 1] ?? "");
    const underLabelRow =
      findMoneyTokens(lines[i - 1] ?? "").length === 0 &&
      (prev.match(/\b(total|montant|ht|ttc|tva|taxe|net|base|remise|escompte)\b/g)?.length ?? 0) >= 2;
    const tokens = [...new Set(findMoneyTokens(raw).filter((v) => v > 0 && !isRateValue(v)))];
    if (tokens.length < 2) continue;

    for (const ht of tokens) {
      for (const vat of tokens) {
        if (vat >= ht) continue;
        const rate = impliedStandardRate(vat, ht);
        if (!rate) continue;
        const expectedTtc = round2(ht + vat);
        const found = tokens.find((t) => Math.abs(t - expectedTtc) <= 0.02);
        const observedTtc = found !== undefined;
        // On n'accepte un triplet QUE si le TTC est observé, ou si la ligne
        // (ou celle des libellés juste au-dessus) porte un mot-clé de total.
        if (!observedTtc && !hasTotalKw && !underLabelRow) continue;
        const score =
          (observedTtc ? 100 : 0) +
          (hasTotalKw || underLabelRow ? 25 : 0) +
          ([20, 10, 5.5].includes(rate) ? 10 : 0) +
          Math.round((i / Math.max(1, lines.length)) * 8); // les totaux sont plutôt en bas
        const cand: Cand = { ht, vat, ttc: found ?? expectedTtc, observedTtc, score };
        // À score égal : on préfère le plus GROS TTC (un total, pas une ligne).
        if (
          !best ||
          cand.score > best.score ||
          (cand.score === best.score && cand.ttc > best.ttc)
        ) {
          best = cand;
        }
      }
    }
  }
  return best ? { ht: best.ht, vat: best.vat, ttc: best.ttc, observedTtc: best.observedTtc } : undefined;
}

export type ExtractedAmounts = {
  totalHT?: number;
  totalVAT?: number;
  totalTTC?: number;
  vatLines: ParsedVatLine[];
  rates: number[];
  notes: string[];
  /** true si au moins un total a été calculé/deviné (et non lu tel quel). */
  uncertain: boolean;
  provenance: { ht?: Provenance; vat?: Provenance; ttc?: Provenance };
};

export function extractAmounts(input: string): ExtractedAmounts {
  const text = stripBoilerplate(input);
  const lines = text.split(/\r?\n/);
  const notes: string[] = [];
  const provenance: ExtractedAmounts["provenance"] = {};

  // Taux de TVA présents : uniquement des taux PLAUSIBLES, et pas ceux annoncés
  // comme une remise / un acompte / une pénalité.
  const rateHits: number[] = [];
  const rateRe = /(?<![\d.,])(-?\d{1,2}(?:[.,]\d{1,2})?)\s*%/g;
  let rm: RegExpExecArray | null;
  while ((rm = rateRe.exec(text))) {
    const before = deburr(text.slice(Math.max(0, rm.index - 24), rm.index));
    if (rm[1].startsWith("-") || /(remise|escompte|rabais|ristourne|acompte|penalit|majoration|reduction)/.test(before)) {
      continue;
    }
    const n = parseFrAmount(rm[1]);
    if (n !== null && n >= 0 && n <= 30 && isPlausibleVatRate(n)) rateHits.push(n);
  }
  const rates = [...new Set(rateHits)];
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

    // HT testé AVANT TVA (une ligne « Base HT … TVA : » décrit une base).
    if (KW.ht.test(d) || (KW.tva.test(d) && KW_IS_BASE.test(d))) {
      htCandidates.push(tokens[tokens.length - 1]);
    } else if (KW.ttc.test(d)) {
      ttcCandidates.push(...tokens);
    } else if (KW.tva.test(d)) {
      // sur une ligne de TVA, prendre le token cohérent avec un taux ×base,
      // à défaut le dernier (aligné à droite), jamais Math.max aveugle.
      const consistent = tokens.find((t) =>
        tokens.some((b) => b !== t && impliedStandardRate(t, b) !== undefined),
      );
      vatCandidates.push(consistent ?? tokens[tokens.length - 1]);
    }
  }

  if (ttcCandidates.length) {
    totalTTC = Math.max(...ttcCandidates);
    provenance.ttc = "observed";
    if (Math.max(...ttcCandidates) - Math.min(...ttcCandidates) > 0.05 * Math.max(...ttcCandidates)) {
      notes.push("Plusieurs montants « TTC » possibles ont été trouvés — vérifiez le total retenu.");
    }
  }
  if (vatCandidates.length) {
    totalVAT = Math.max(...vatCandidates);
    provenance.vat = "observed";
  }
  if (htCandidates.length) {
    totalHT = mostFrequent(htCandidates);
    provenance.ht = "observed";
  }

  // Tableau de totaux (libellés séparés des valeurs).
  const triple = bestCoherentTriple(lines, isRateValue);
  if (triple) {
    const currentCoherent =
      totalHT !== undefined && totalVAT !== undefined && totalTTC !== undefined &&
      Math.abs(totalHT + totalVAT - totalTTC) <= 0.05;
    const ttcAgrees = totalTTC === undefined || Math.abs(totalTTC - triple.ttc) <= 0.05;

    if (currentCoherent) {
      // Les 3 totaux mots-clés sont déjà cohérents entre eux : on n'y touche pas.
    } else if (triple.observedTtc && ttcAgrees) {
      // Le triplet est un VRAI bloc de totaux : ses 3 valeurs sont sur une même
      // ligne, HT + TVA = TTC, taux standard, et son TTC concorde avec le
      // « net à payer » lu. Il fait AUTORITÉ (un « Montant HT » lu ailleurs est
      // souvent un sous-total de section / de livraison).
      const htChanged = totalHT !== undefined && Math.abs(totalHT - triple.ht) > 0.05;
      totalHT = triple.ht;
      totalVAT = triple.vat;
      totalTTC = triple.ttc;
      provenance.ht = provenance.vat = provenance.ttc = "table";
      if (htChanged) {
        notes.push(
          "Le Total HT retenu vient du bloc de totaux (une valeur intermédiaire figurait ailleurs) — à vérifier.",
        );
      }
    } else if (triple.observedTtc && totalTTC !== undefined && !ttcAgrees) {
      // Deux blocs de totaux possibles qui se contredisent : on ne choisit pas
      // en silence.
      notes.push(
        "Plusieurs totaux possibles ont été détectés — vérifiez chaque montant (HT, TVA, TTC).",
      );
      if (totalHT === undefined) { totalHT = triple.ht; provenance.ht = "guessed"; }
      if (totalVAT === undefined) { totalVAT = triple.vat; provenance.vat = "guessed"; }
    } else {
      // Triplet sans TTC observé, ou incomplet : on complète les trous, et si les
      // 3 valeurs existantes se contredisent on adopte le triplet cohérent.
      const haveAll = totalHT !== undefined && totalVAT !== undefined && totalTTC !== undefined;
      if (haveAll) {
        totalHT = triple.ht;
        totalVAT = triple.vat;
        totalTTC = triple.ttc;
        provenance.ht = provenance.vat = "table";
        provenance.ttc = triple.observedTtc ? "table" : "computed";
        notes.push("Les totaux lus se contredisaient : recalculés depuis le tableau — à vérifier.");
      } else {
        if (totalHT === undefined) { totalHT = triple.ht; provenance.ht = "table"; }
        if (totalVAT === undefined) { totalVAT = triple.vat; provenance.vat = "table"; }
        if (totalTTC === undefined) {
          totalTTC = triple.ttc;
          provenance.ttc = triple.observedTtc ? "table" : "computed";
        }
      }
    }
  }

  // Filet de sécurité : UNIQUEMENT une ligne explicitement « TTC / net à payer /
  // montant dû » en bas de page, avec un contexte monétaire (pas « poids total »).
  if (totalTTC === undefined) {
    for (let i = lines.length - 1; i >= 0 && i > lines.length - 18; i--) {
      const d = deburr(lines[i]);
      if (!/(net a payer|montant du|\bttc\b|toutes taxes|reste a payer|a regler)/.test(d)) continue;
      if (/(kg|km|\bh\b|heures?|jours?|colis|poids|points?|unites?)/.test(d)) continue;
      const tokens = findMoneyTokens(lines[i]);
      if (tokens.length) {
        totalTTC = tokens[tokens.length - 1];
        provenance.ttc = "guessed";
        notes.push("Total TTC incertain (déduit d'une ligne de pied de page) — à vérifier.");
        break;
      }
    }
  }

  // Complétion par calcul si un seul montant manque.
  const known = [totalHT, totalVAT, totalTTC].filter((v) => v !== undefined).length;
  if (known === 2) {
    if (totalHT === undefined) {
      totalHT = round2(totalTTC! - totalVAT!);
      provenance.ht = "computed";
      notes.push("Total HT calculé (TTC − TVA) — à vérifier.");
    } else if (totalVAT === undefined) {
      totalVAT = round2(totalTTC! - totalHT!);
      provenance.vat = "computed";
      notes.push("Montant de TVA calculé (TTC − HT) — à vérifier.");
    } else if (totalTTC === undefined) {
      totalTTC = round2(totalHT! + totalVAT!);
      provenance.ttc = "computed";
      notes.push("Total TTC calculé (HT + TVA) — à vérifier.");
    }
  }

  // Contrôles de vraisemblance sur le résultat (jamais silencieux).
  if (totalVAT !== undefined && totalVAT < 0) {
    notes.push("Montant de TVA négatif obtenu — lecture peu fiable, à corriger.");
  }
  if (
    totalHT !== undefined && totalVAT !== undefined && totalHT > 0 &&
    (totalVAT ?? 0) !== 0 && impliedStandardRate(totalVAT, totalHT) === undefined
  ) {
    const r = round2((totalVAT / totalHT) * 100);
    notes.push(`Le taux de TVA implicite (${r} %) ne correspond à aucun taux connu — vérifiez HT et TVA.`);
  }

  // Taux déduit du rapport TVA / HT si aucun taux clair n'a été lu.
  let inferredRate: number | undefined;
  if (!nonZeroRates.length && totalHT && totalVAT) {
    inferredRate = impliedStandardRate(totalVAT, totalHT);
  }

  // Lignes de TVA.
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
      for (const rMatch of raw.matchAll(/(\d{1,2}(?:[.,]\d{1,2})?)\s*%/g)) {
        const rate = parseFrAmount(rMatch[1]);
        if (rate === null || rate <= 0 || !isPlausibleVatRate(rate)) continue;
        const tokens = findMoneyTokens(raw);
        if (tokens.length < 2) continue;
        for (let a = 0; a < tokens.length; a++) {
          for (let b = 0; b < tokens.length; b++) {
            if (a === b) continue;
            const expected = round2((tokens[a] * rate) / 100);
            if (Math.abs(expected - tokens[b]) <= Math.max(0.02, expected * 0.002)) {
              found.push({ rate, baseHT: tokens[a], vatAmount: tokens[b] });
            }
          }
        }
      }
    }
    const byRate = new Map<number, ParsedVatLine>();
    for (const l of found) if (!byRate.has(l.rate)) byRate.set(l.rate, l);
    const candidate = [...byRate.values()];
    const sumHT = round2(candidate.reduce((s, l) => s + l.baseHT, 0));
    const sumVAT = round2(candidate.reduce((s, l) => s + l.vatAmount, 0));
    const okHT = totalHT === undefined || Math.abs(sumHT - totalHT) <= 0.05;
    const okVAT = totalVAT === undefined || Math.abs(sumVAT - totalVAT) <= 0.05;
    // On ne peuple les totaux depuis les sommes QUE si elles recoupent un total lu.
    if (candidate.length >= 2 && okHT && okVAT && (totalHT !== undefined || totalTTC !== undefined)) {
      vatLines = candidate;
      if (totalHT === undefined) { totalHT = sumHT; provenance.ht = "table"; }
      if (totalVAT === undefined) { totalVAT = sumVAT; provenance.vat = "table"; }
      if (totalTTC === undefined) { totalTTC = round2(sumHT + sumVAT); provenance.ttc = "computed"; }
    } else {
      notes.push("Plusieurs taux de TVA détectés mais le détail par taux n'a pas pu être reconstitué de façon fiable.");
    }
  }

  const uncertain =
    provenance.ht === "computed" || provenance.ht === "guessed" ||
    provenance.vat === "computed" || provenance.vat === "guessed" ||
    provenance.ttc === "computed" || provenance.ttc === "guessed";

  return { totalHT, totalVAT, totalTTC, vatLines, rates: nonZeroRates, notes, uncertain, provenance };
}

// ---------------------------------------------------------------------------
//  Assemblage
// ---------------------------------------------------------------------------

export function buildParsedInvoice(text: string, engine: string): ParsedInvoice {
  const clean = (text ?? "").replace(/ /g, " ");
  const warnings: string[] = [];

  if (clean.replace(/\s/g, "").length < 25) {
    return {
      confidence: 0,
      engine,
      amountsUncertain: true,
      warnings: [
        "Ce PDF ne contient pas de texte lisible (il s'agit probablement d'un scan ou d'une image). " +
          "Veuillez saisir les informations manuellement.",
      ],
    };
  }

  const documentType = extractDocumentType(clean);
  const dates = extractDates(clean);
  let { invoiceDate, dueDate } = dates;
  const dateNotes = dates.notes;
  const amounts = extractAmounts(clean);
  warnings.push(...amounts.notes, ...dateNotes);

  const number = extractInvoiceNumber(clean);
  const siret = extractSiret(clean);
  const vatNumber = extractVatNumber(clean);
  const { currency, ambiguous: currencyAmbiguous } = extractCurrency(clean);
  const partyName = extractSupplier(clean);

  // Un AVOIR se stocke en valeurs POSITIVES (le signe est porté par l'agrégation).
  let { totalHT, totalVAT, totalTTC } = amounts;
  let vatLines = amounts.vatLines;

  // --- Relevé de factures ? -------------------------------------------------
  // Un relevé LISTE des factures déjà émises. Ses totaux (cumul) sont conservés
  // tels quels ; le rapprochement avec les factures déjà saisies et la
  // « compensation » se font ensuite (src/lib/invoices/statements.ts).
  const statement = documentType === "facture" ? detectStatement(clean) : null;
  let statementLines: ParsedInvoice["statementLines"];
  if (statement) {
    statementLines = statement.lines;
    if (statement.grossTTC !== undefined) totalTTC = statement.grossTTC;
    if (statement.grossHT !== undefined) totalHT = statement.grossHT;
    if (statement.grossVAT !== undefined) totalVAT = statement.grossVAT;
    else if (totalHT !== undefined && totalTTC !== undefined) totalVAT = round2(totalTTC - totalHT);
    if (totalHT !== undefined && totalVAT !== undefined) {
      const rate = impliedStandardRate(totalVAT, totalHT);
      vatLines = rate !== undefined ? [{ rate, baseHT: totalHT, vatAmount: totalVAT }] : vatLines;
    }
    if (statement.dueDate) dueDate = statement.dueDate;
    // Date du relevé : la dernière facture listée (plus représentatif que la 1re
    // date croisée). On remplace l'avertissement générique « date non libellée ».
    const lineDates = statement.lines.map((l) => l.date).filter((d): d is string => Boolean(d)).sort();
    if (lineDates.length) {
      invoiceDate = lineDates[lineDates.length - 1];
      const i = warnings.findIndex((n) => /date de facture non libell/i.test(n));
      if (i >= 0) warnings[i] = "Date du relevé estimée (dernière facture listée) — ajustez-la si besoin.";
      else warnings.push("Date du relevé estimée (dernière facture listée) — ajustez-la si besoin.");
    }
    warnings.unshift(
      `Document détecté comme un RELEVÉ de ${statement.lines.length} facture(s) (cumul ${
        totalTTC?.toFixed(2) ?? "?"
      } €). Les factures déjà présentes dans le logiciel seront rapprochées et ne seront pas comptées deux fois. ` +
        (statement.sumMatchesTotal
          ? "Vérifiez malgré tout le classement avant de valider."
          : "⚠️ La somme des lignes ne correspond pas exactement au total imprimé — à vérifier."),
    );
  }
  if (documentType === "avoir") {
    const abs = (n: number | undefined) => (n === undefined ? undefined : Math.abs(n));
    if ([totalHT, totalVAT, totalTTC].some((n) => n !== undefined && n < 0)) {
      warnings.push("Avoir : montants enregistrés en valeur positive (le signe est appliqué au calcul de TVA).");
    }
    totalHT = abs(totalHT);
    totalVAT = abs(totalVAT);
    totalTTC = abs(totalTTC);
    vatLines = vatLines.map((l) => ({ rate: l.rate, baseHT: Math.abs(l.baseHT), vatAmount: Math.abs(l.vatAmount) }));
  } else if ([totalHT, totalVAT, totalTTC].some((n) => n !== undefined && n < 0)) {
    warnings.push("Un montant total est négatif alors que ce document est une facture — à vérifier (avoir ?).");
  }

  if (currencyAmbiguous) warnings.push("Devise ambiguë (plusieurs symboles monétaires détectés) — à vérifier.");
  if (!number) warnings.push("Numéro de facture non détecté.");
  if (!invoiceDate) warnings.push("Date de facture non détectée.");
  if (!dueDate) warnings.push("Date d'échéance non détectée (« Échéance non indiquée »).");
  if (totalHT === undefined) warnings.push("Total HT non détecté.");
  if (totalVAT === undefined) warnings.push("Montant de TVA non détecté.");
  if (totalTTC === undefined) warnings.push("Total TTC non détecté.");
  if (!partyName) warnings.push("Nom du fournisseur / client non détecté.");

  // Cohérence HT + TVA = TTC : n'a de valeur que si les 3 ont été OBSERVÉS.
  const allObserved =
    amounts.provenance.ht === "observed" &&
    amounts.provenance.vat === "observed" &&
    amounts.provenance.ttc === "observed";
  let coherent = false;
  if (totalHT !== undefined && totalVAT !== undefined && totalTTC !== undefined) {
    coherent = Math.abs(totalHT + totalVAT - totalTTC) <= 0.02;
    if (!coherent) {
      warnings.push("Attention : HT + TVA ne correspond pas au TTC détecté. Vérifiez les montants.");
    }
  }

  // Confiance : la PROVENANCE prime. Un total calculé / deviné plafonne la confiance.
  const weight = (p?: Provenance) => (p === "observed" ? 1 : p === "table" ? 0.6 : p === "computed" ? 0.35 : p === "guessed" ? 0.15 : 0);
  const score =
    0.4 * weight(amounts.provenance.ttc) +
    0.2 * weight(amounts.provenance.ht) +
    0.15 * weight(amounts.provenance.vat) +
    (number ? 0.1 : 0) +
    (invoiceDate && !dateNotes.length ? 0.1 : invoiceDate ? 0.04 : 0) +
    (coherent && allObserved ? 0.05 : 0);
  let confidence = Math.min(1, round2(score));
  if (amounts.uncertain) confidence = Math.min(confidence, 0.5);
  // Un relevé doit toujours passer par une vérification (rapprochement des
  // factures) : on ne le présente jamais comme « sûr ».
  if (statement) confidence = Math.min(confidence, 0.7);

  return {
    documentType,
    number,
    invoiceDate,
    dueDate,
    partyName,
    siret,
    vatNumber,
    currency,
    totalHT,
    totalVAT,
    totalTTC,
    vatLines: vatLines.length ? vatLines : undefined,
    isStatement: statement ? true : undefined,
    statementLines,
    confidence,
    amountsUncertain: amounts.uncertain || totalHT === undefined || totalVAT === undefined || totalTTC === undefined || !coherent,
    warnings,
    engine,
  };
}
