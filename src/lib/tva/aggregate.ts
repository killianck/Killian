// Agrégation des factures : totaux par mois et par an.
//
// Les dates de facture sont stockées à minuit UTC ("AAAA-MM-JJ") : on compare
// donc TOUJOURS en UTC, de bout en bout (cohérent avec src/lib/invoices/filter.ts).

import { DIRECTIONS, DOCUMENT_TYPES, type Direction, type DocumentType } from "@/lib/domain/enums";
import { netVat, round2, vatContribution } from "./rules";

export type AggregatableInvoice = {
  invoiceDate: Date | string;
  direction: Direction | string;
  documentType: DocumentType | string;
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
  /** Somme signée des TVA (sert au contrôle HT + TVA = TTC). */
  totalVAT: number;
  totalTTC: number;
  /** Factures ignorées faute de date/valeur exploitable (jamais silencieux). */
  excludedCount: number;
  /**
   * Factures dont HT + TVA ≠ TTC (typiquement : montant partiellement lu, HT
   * resté à 0 alors qu'un TTC a été trouvé). Elles faussent les totaux affichés :
   * on ne doit JAMAIS présenter le cumul comme fiable sans le signaler.
   */
  incoherentCount: number;
  /** Écart global TTC − (HT + TVA), arrondi. 0 = totaux cohérents. */
  gap: number;
};

const EMPTY: VatTotals = {
  count: 0,
  collectedVat: 0,
  deductibleVat: 0,
  netVat: 0,
  totalHT: 0,
  totalVAT: 0,
  totalTTC: 0,
  excludedCount: 0,
  incoherentCount: 0,
  gap: 0,
};

function asDate(d: Date | string): Date {
  return d instanceof Date ? d : new Date(d);
}

/** Signe appliqué aux montants HT/TTC : un avoir vient en déduction. */
function docSign(documentType: string): number {
  return documentType === "avoir" ? -1 : 1;
}

/** Normalise en clé d'énumération, ou undefined si la valeur est aberrante. */
function normDirection(v: string): "achat" | "vente" | undefined {
  return v === "achat" || v === "vente" ? v : v in DIRECTIONS ? (v as "achat" | "vente") : undefined;
}
function normDocType(v: string): "facture" | "avoir" | undefined {
  return v === "facture" || v === "avoir" ? v : v in DOCUMENT_TYPES ? (v as "facture" | "avoir") : undefined;
}

/** Totalise une liste de factures (déjà filtrée sur la période voulue). */
export function sumInvoices(invoices: AggregatableInvoice[]): VatTotals {
  const t = { ...EMPTY };

  for (const inv of invoices) {
    const direction = normDirection(String(inv.direction));
    const documentType = normDocType(String(inv.documentType));
    const dateOk = !Number.isNaN(asDate(inv.invoiceDate).getTime());
    if (!direction || !documentType || !dateOk || !Number.isFinite(inv.totalVAT)) {
      t.excludedCount += 1;
      continue;
    }

    const sign = docSign(documentType);
    const contrib = vatContribution({
      direction,
      documentType,
      vatAmount: inv.totalVAT,
      deductible: inv.deductible,
    });

    t.count += 1;
    t.collectedVat += contrib.collected;
    t.deductibleVat += contrib.deductible;
    t.totalHT += sign * inv.totalHT;
    t.totalVAT += sign * inv.totalVAT;
    t.totalTTC += sign * inv.totalTTC;

    // Contrôle facture par facture : un document dont HT + TVA ≠ TTC fausse
    // le cumul (cas typique : seul le TTC a pu être lu, HT resté à 0).
    const ht = inv.totalHT ?? 0;
    const vat = inv.totalVAT ?? 0;
    const ttc = inv.totalTTC ?? 0;
    if ((ht || vat || ttc) && Math.abs(ht + vat - ttc) > 0.02) t.incoherentCount += 1;
  }

  t.collectedVat = round2(t.collectedVat);
  t.deductibleVat = round2(t.deductibleVat);
  t.totalHT = round2(t.totalHT);
  t.totalVAT = round2(t.totalVAT);
  t.totalTTC = round2(t.totalTTC);
  t.netVat = netVat(t.collectedVat, t.deductibleVat);
  t.gap = round2(t.totalTTC - t.totalHT - t.totalVAT);

  return t;
}

/** Filtre + totalise pour un mois donné (month : 1-12), en UTC. */
export function totalsForMonth(invoices: AggregatableInvoice[], year: number, month: number): VatTotals {
  return sumInvoices(
    invoices.filter((inv) => {
      const d = asDate(inv.invoiceDate);
      return !Number.isNaN(d.getTime()) && d.getUTCFullYear() === year && d.getUTCMonth() + 1 === month;
    }),
  );
}

/** Filtre + totalise pour une année entière, en UTC. */
export function totalsForYear(invoices: AggregatableInvoice[], year: number): VatTotals {
  return sumInvoices(
    invoices.filter((inv) => {
      const d = asDate(inv.invoiceDate);
      return !Number.isNaN(d.getTime()) && d.getUTCFullYear() === year;
    }),
  );
}

/** Renvoie les 12 totaux mensuels d'une année (index 0 = janvier). */
export function monthlyBreakdown(invoices: AggregatableInvoice[], year: number): VatTotals[] {
  return Array.from({ length: 12 }, (_, i) => totalsForMonth(invoices, year, i + 1));
}
