// Lecture d'un formulaire de facture (création ou modification) -> données prêtes
// pour la base. Partagé entre la saisie manuelle et la correction d'une facture.

import { parseAmount } from "@/lib/format";
import { checkCoherence } from "@/lib/tva/coherence";
import { round2 } from "@/lib/tva/rules";
import { totalsFromLines } from "@/lib/tva/lines";
import { CATEGORIES } from "@/lib/domain/enums";
import type { CoherenceLevel } from "@/lib/domain/enums";

export type InvoiceLine = { rate: number; baseHT: number; vatAmount: number };

/** État renvoyé par les actions de création / modification (pour useActionState). */
export type InvoiceFormState = { error?: string; ok?: boolean };

export type InvoiceFormData = {
  documentType: "facture" | "avoir";
  direction: "achat" | "vente";
  category: string | null;
  number: string | null;
  invoiceDate: Date;
  dueDate: Date | null;
  partyName: string | null;
  partyAddress: string | null;
  siret: string | null;
  vatNumber: string | null;
  currency: string;
  notes: string | null;
  totalHT: number;
  totalVAT: number;
  totalTTC: number;
  deductible: boolean; // TVA d'achat récupérable ? (sans objet pour une vente)
};

export type ParsedInvoiceForm =
  | { ok: true; data: InvoiceFormData; lines: InvoiceLine[]; coherence: CoherenceLevel }
  | { ok: false; error: string };

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const orNull = (v: string) => (v === "" ? null : v);
function parseDate(v: string): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}
/** "AAAA-MM-JJ" d'une Date (UTC), pour les contrôles de cohérence. */
function isoDay(d: Date | null): string | undefined {
  if (!d) return undefined;
  return d.toISOString().slice(0, 10);
}

export function parseInvoiceForm(fd: FormData): ParsedInvoiceForm {
  const documentType = str(fd, "documentType") === "avoir" ? "avoir" : "facture";
  const isAvoir = documentType === "avoir";

  // Lignes de TVA (champ caché JSON alimenté par le formulaire).
  // Une ligne « fantôme » {taux, 0, 0} (aucun montant) est ignorée.
  let lines: InvoiceLine[] = [];
  try {
    const raw = JSON.parse(str(fd, "vatLinesJson") || "[]") as Array<Record<string, unknown>>;
    lines = raw
      .map((l) => ({
        rate: parseAmount(l.rate as string),
        baseHT: parseAmount(l.baseHT as string),
        vatAmount: parseAmount(l.vatAmount as string),
      }))
      .filter((l) => l.baseHT !== 0 || l.vatAmount !== 0);
  } catch {
    return { ok: false, error: "Les lignes de TVA sont mal formées." };
  }

  const invoiceDate = parseDate(str(fd, "invoiceDate"));
  if (!invoiceDate) return { ok: false, error: "La date de facture est obligatoire." };
  const dueDate = parseDate(str(fd, "dueDate"));

  const fromLines = totalsFromLines(lines);
  const rawHT = str(fd, "totalHT");
  const rawVAT = str(fd, "totalVAT");
  const rawTTC = str(fd, "totalTTC");
  const hasManualTotals = rawHT !== "" || rawVAT !== "" || rawTTC !== "";
  const hasRealLines = lines.length > 0;

  // GARDE-FOU : sans ligne réelle ET sans total saisi, on n'écrit PAS 0/0/0
  // (cela effacerait silencieusement les montants d'une facture importée).
  if (!hasRealLines && !hasManualTotals) {
    return {
      ok: false,
      error:
        "Renseignez les montants : soit au moins une ligne de TVA, soit les totaux " +
        "(cochez « Saisir les totaux manuellement »).",
    };
  }

  let totalHT = hasManualTotals ? parseAmount(rawHT) : fromLines.totalHT;
  let totalVAT = hasManualTotals ? parseAmount(rawVAT) : fromLines.totalVAT;
  let totalTTC = hasManualTotals
    ? rawTTC !== ""
      ? parseAmount(rawTTC)
      : round2(totalHT + totalVAT)
    : fromLines.totalTTC;

  // Un AVOIR se stocke en valeurs POSITIVES ; sinon un montant négatif est refusé.
  if (isAvoir) {
    totalHT = Math.abs(totalHT);
    totalVAT = Math.abs(totalVAT);
    totalTTC = Math.abs(totalTTC);
    lines = lines.map((l) => ({ rate: l.rate, baseHT: Math.abs(l.baseHT), vatAmount: Math.abs(l.vatAmount) }));
  } else if (totalHT < 0 || totalVAT < 0 || totalTTC < 0) {
    return {
      ok: false,
      error: "Un montant est négatif. Pour un remboursement, choisissez le type « Avoir ».",
    };
  }

  const direction = str(fd, "direction") === "vente" ? "vente" : "achat";
  const currencyRaw = str(fd, "currency").toUpperCase();
  if (currencyRaw && !/^[A-Z]{3}$/.test(currencyRaw)) {
    return { ok: false, error: "Code devise invalide (3 lettres, ex. EUR, USD, CHF)." };
  }
  const categoryRaw = str(fd, "category");
  const category = categoryRaw && categoryRaw in CATEGORIES ? categoryRaw : null;

  const data: InvoiceFormData = {
    documentType,
    direction,
    category,
    number: orNull(str(fd, "number")),
    invoiceDate,
    dueDate,
    partyName: orNull(str(fd, "partyName")),
    partyAddress: orNull(str(fd, "partyAddress")),
    siret: orNull(str(fd, "siret")),
    vatNumber: orNull(str(fd, "vatNumber")),
    currency: currencyRaw || "EUR",
    notes: orNull(str(fd, "notes")),
    totalHT,
    totalVAT,
    totalTTC,
    deductible: direction === "vente" ? true : fd.get("deductible") === "1",
  };

  const coherence = checkCoherence({
    totalHT,
    totalVAT,
    totalTTC,
    vatLines: lines,
    documentType,
    invoiceDate: isoDay(invoiceDate),
    dueDate: isoDay(dueDate),
  }).level;

  return { ok: true, data, lines, coherence };
}
