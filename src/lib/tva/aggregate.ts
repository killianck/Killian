// Agrégation des factures : totaux par mois et par an.

import type { Direction, DocumentType } from "@/lib/domain/enums";
import { netVat, round2, vatContribution } from "./rules";

export type AggregatableInvoice = {
  invoiceDate: Date | string;
  direction: Direction;
  documentType: DocumentType;
  totalHT: number;
  totalVAT: number;
  totalTTC: number;
  deductible?: boolean;
};

export type VatTotals = {
  count: number;
  collectedVat: number; // TVA collectée
  deductibleVat: number; // TVA déductible
  netVat: number; // TVA nette estimée
  totalHT: number;
  totalTTC: number;
};

const EMPTY: VatTotals = {
  count: 0,
  collectedVat: 0,
  deductibleVat: 0,
  netVat: 0,
  totalHT: 0,
  totalTTC: 0,
};

function asDate(d: Date | string): Date {
  return d instanceof Date ? d : new Date(d);
}

/** Signe appliqué aux montants HT/TTC : un avoir vient en déduction. */
function docSign(documentType: DocumentType): number {
  return documentType === "avoir" ? -1 : 1;
}

/** Totalise une liste de factures (déjà filtrée sur la période voulue). */
export function sumInvoices(invoices: AggregatableInvoice[]): VatTotals {
  const t = { ...EMPTY };

  for (const inv of invoices) {
    const sign = docSign(inv.documentType);
    const contrib = vatContribution({
      direction: inv.direction,
      documentType: inv.documentType,
      vatAmount: inv.totalVAT,
      deductible: inv.deductible,
    });

    t.count += 1;
    t.collectedVat += contrib.collected;
    t.deductibleVat += contrib.deductible;
    t.totalHT += sign * inv.totalHT;
    t.totalTTC += sign * inv.totalTTC;
  }

  t.collectedVat = round2(t.collectedVat);
  t.deductibleVat = round2(t.deductibleVat);
  t.totalHT = round2(t.totalHT);
  t.totalTTC = round2(t.totalTTC);
  t.netVat = netVat(t.collectedVat, t.deductibleVat);

  return t;
}

/** Filtre + totalise pour un mois donné (month : 1-12). */
export function totalsForMonth(
  invoices: AggregatableInvoice[],
  year: number,
  month: number,
): VatTotals {
  return sumInvoices(
    invoices.filter((inv) => {
      const d = asDate(inv.invoiceDate);
      return d.getFullYear() === year && d.getMonth() + 1 === month;
    }),
  );
}

/** Filtre + totalise pour une année entière. */
export function totalsForYear(invoices: AggregatableInvoice[], year: number): VatTotals {
  return sumInvoices(
    invoices.filter((inv) => asDate(inv.invoiceDate).getFullYear() === year),
  );
}

/** Renvoie les 12 totaux mensuels d'une année (index 0 = janvier). */
export function monthlyBreakdown(
  invoices: AggregatableInvoice[],
  year: number,
): VatTotals[] {
  return Array.from({ length: 12 }, (_, i) => totalsForMonth(invoices, year, i + 1));
}
