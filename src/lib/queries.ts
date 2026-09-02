// Fonctions de lecture de la base, réutilisées par les pages (côté serveur).

import { prisma } from "@/lib/db";
import type { AggregatableInvoice } from "@/lib/tva/aggregate";

export type InvoiceWithLines = Awaited<ReturnType<typeof getInvoices>>[number];

export async function getInvoices() {
  return prisma.invoice.findMany({
    orderBy: { invoiceDate: "desc" },
    include: { vatLines: true },
  });
}

export async function getInvoice(id: string) {
  return prisma.invoice.findUnique({
    where: { id },
    include: { vatLines: true, revisions: { orderBy: { changedAt: "desc" } } },
  });
}

/** Convertit les lignes Prisma vers le format attendu par l'agrégateur TVA. */
export function toAggregatable(
  invoices: { invoiceDate: Date; direction: string; documentType: string; totalHT: number; totalVAT: number; totalTTC: number }[],
): AggregatableInvoice[] {
  return invoices.map((i) => ({
    invoiceDate: i.invoiceDate,
    direction: i.direction as AggregatableInvoice["direction"],
    documentType: i.documentType as AggregatableInvoice["documentType"],
    totalHT: i.totalHT,
    totalVAT: i.totalVAT,
    totalTTC: i.totalTTC,
  }));
}

/** Années présentes en base (pour les sélecteurs), ordre décroissant. */
export async function getAvailableYears(): Promise<number[]> {
  const rows = await prisma.invoice.findMany({ select: { invoiceDate: true } });
  const years = new Set<number>(rows.map((r) => r.invoiceDate.getFullYear()));
  years.add(new Date().getFullYear());
  return [...years].sort((a, b) => b - a);
}

/** Prochaines échéances (dueDate >= aujourd'hui), triées, limitées. */
export async function getUpcomingDueDates(limit = 8) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return prisma.invoice.findMany({
    where: { dueDate: { gte: today } },
    orderBy: { dueDate: "asc" },
    take: limit,
    select: {
      id: true,
      number: true,
      partyName: true,
      direction: true,
      invoiceDate: true,
      dueDate: true,
      totalTTC: true,
      currency: true,
    },
  });
}
