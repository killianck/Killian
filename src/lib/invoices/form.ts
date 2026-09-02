// Lecture d'un formulaire de facture (création ou modification) -> données prêtes
// pour la base. Partagé entre la saisie manuelle et la correction d'une facture.

import { parseAmount } from "@/lib/format";
import { checkCoherence } from "@/lib/tva/coherence";
import { totalsFromLines } from "@/lib/tva/lines";
import type { CoherenceLevel } from "@/lib/domain/enums";

export type InvoiceLine = { rate: number; baseHT: number; vatAmount: number };

/** État renvoyé par les actions de création / modification (pour useActionState). */
export type InvoiceFormState = { error?: string };

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

export function parseInvoiceForm(fd: FormData): ParsedInvoiceForm {
  // Lignes de TVA (champ caché JSON alimenté par le formulaire)
  let lines: InvoiceLine[] = [];
  try {
    const raw = JSON.parse(str(fd, "vatLinesJson") || "[]") as Array<Record<string, unknown>>;
    lines = raw
      .map((l) => ({
        rate: parseAmount(l.rate as string),
        baseHT: parseAmount(l.baseHT as string),
        vatAmount: parseAmount(l.vatAmount as string),
      }))
      .filter((l) => l.baseHT !== 0 || l.vatAmount !== 0 || l.rate !== 0);
  } catch {
    return { ok: false, error: "Les lignes de TVA sont mal formées." };
  }

  const invoiceDate = parseDate(str(fd, "invoiceDate"));
  if (!invoiceDate) return { ok: false, error: "La date de facture est obligatoire." };

  const fromLines = totalsFromLines(lines);
  const hasManualTotals =
    str(fd, "totalHT") !== "" || str(fd, "totalVAT") !== "" || str(fd, "totalTTC") !== "";
  const totalHT = hasManualTotals ? parseAmount(str(fd, "totalHT")) : fromLines.totalHT;
  const totalVAT = hasManualTotals ? parseAmount(str(fd, "totalVAT")) : fromLines.totalVAT;
  const totalTTC = hasManualTotals
    ? parseAmount(str(fd, "totalTTC")) || Math.round((totalHT + totalVAT) * 100) / 100
    : fromLines.totalTTC;

  const direction = str(fd, "direction") === "vente" ? "vente" : "achat";
  const data: InvoiceFormData = {
    documentType: str(fd, "documentType") === "avoir" ? "avoir" : "facture",
    direction,
    category: orNull(str(fd, "category")),
    number: orNull(str(fd, "number")),
    invoiceDate,
    dueDate: parseDate(str(fd, "dueDate")),
    partyName: orNull(str(fd, "partyName")),
    partyAddress: orNull(str(fd, "partyAddress")),
    siret: orNull(str(fd, "siret")),
    vatNumber: orNull(str(fd, "vatNumber")),
    currency: orNull(str(fd, "currency")) ?? "EUR",
    notes: orNull(str(fd, "notes")),
    totalHT,
    totalVAT,
    totalTTC,
    // pour une vente, la notion ne s'applique pas -> true ; pour un achat,
    // la case cochée envoie "1", décochée -> absente
    deductible: direction === "vente" ? true : fd.get("deductible") === "1",
  };

  const coherence = checkCoherence({ totalHT, totalVAT, totalTTC, vatLines: lines }).level;
  return { ok: true, data, lines, coherence };
}
