// Comparaison "avant / après" d'une facture pour alimenter le journal des
// modifications (table InvoiceRevision).

import { CATEGORIES, DIRECTIONS, DOCUMENT_TYPES, labelOf } from "./enums";
import { formatDate } from "@/lib/format";

/** Champs suivis + libellé lisible pour le journal. */
export const TRACKED_FIELDS: Record<string, string> = {
  documentType: "Type de document",
  direction: "Sens",
  category: "Catégorie",
  number: "Numéro",
  invoiceDate: "Date de facture",
  dueDate: "Date d'échéance",
  partyName: "Fournisseur / Client",
  partyAddress: "Adresse",
  siret: "SIRET",
  vatNumber: "TVA intracommunautaire",
  currency: "Devise",
  totalHT: "Total HT",
  totalVAT: "Total TVA",
  totalTTC: "Total TTC",
  deductible: "TVA récupérable",
  notes: "Notes",
  vatLines: "Lignes de TVA",
};

function display(field: string, value: unknown): string {
  if (field === "deductible") return value === false ? "Non" : "Oui";
  if (value === null || value === undefined || value === "") return "—";
  if (field === "invoiceDate" || field === "dueDate") return formatDate(value as string);
  if (field === "documentType") return labelOf(DOCUMENT_TYPES, value as string);
  if (field === "direction") return labelOf(DIRECTIONS, value as string);
  if (field === "category") return labelOf(CATEGORIES, value as string);
  if (field === "vatLines" && Array.isArray(value)) {
    if (value.length === 0) return "aucune ligne";
    return value
      .map((l: { rate: number; baseHT: number; vatAmount: number }) => `${l.rate} % (${l.baseHT} HT / ${l.vatAmount} TVA)`)
      .join(" ; ");
  }
  return String(value);
}

export type RevisionEntry = { field: string; oldValue: string; newValue: string };

/**
 * Renvoie la liste des champs modifiés (avec anciennes/nouvelles valeurs
 * déjà formatées pour l'affichage).
 */
export function diffInvoice(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): RevisionEntry[] {
  const entries: RevisionEntry[] = [];
  for (const field of Object.keys(TRACKED_FIELDS)) {
    const a = normalize(before[field]);
    const b = normalize(after[field]);
    if (a !== b) {
      entries.push({
        field: TRACKED_FIELDS[field],
        oldValue: display(field, before[field]),
        newValue: display(field, after[field]),
      });
    }
  }
  return entries;
}

function normalize(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (Array.isArray(v)) {
    return v
      .map((l: { rate: number; baseHT: number; vatAmount: number }) => `${l.rate}:${l.baseHT}:${l.vatAmount}`)
      .join("|");
  }
  return String(v);
}
