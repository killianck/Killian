// Fonctions de lecture de la base, réutilisées par les pages (côté serveur).

import { prisma } from "@/lib/db";
import type { AggregatableInvoice } from "@/lib/tva/aggregate";
import { isDuplicatePair, type DuplicateCandidate } from "@/lib/invoices/duplicates";

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
    include: {
      vatLines: true,
      party: true,
      revisions: { orderBy: { changedAt: "desc" } },
      // Détail du relevé (si c'en est un) + facture rapprochée de chaque ligne.
      statementLines: {
        orderBy: { lineDate: "asc" },
        include: { matchedInvoice: { select: { id: true, number: true, totalTTC: true, status: true } } },
      },
      // Relevé(s) sur lesquels CETTE facture figure.
      statementRefs: {
        include: { statement: { select: { id: true, number: true, partyName: true, invoiceDate: true } } },
      },
    },
  });
}

/** Convertit les lignes Prisma vers le format attendu par l'agrégateur TVA. */
export function toAggregatable(
  invoices: {
    invoiceDate: Date;
    direction: string;
    documentType: string;
    totalHT: number;
    totalVAT: number;
    totalTTC: number;
    deductible?: boolean;
  }[],
): AggregatableInvoice[] {
  return invoices.map((i) => ({
    invoiceDate: i.invoiceDate,
    direction: i.direction as AggregatableInvoice["direction"],
    documentType: i.documentType as AggregatableInvoice["documentType"],
    totalHT: i.totalHT,
    totalVAT: i.totalVAT,
    totalTTC: i.totalTTC,
    deductible: i.deductible,
  }));
}

/** Autres factures qui semblent être des doublons de celle-ci. */
export async function getDuplicatesOf(inv: DuplicateCandidate) {
  const others = await prisma.invoice.findMany({
    where: { id: { not: inv.id } },
    select: { id: true, number: true, partyName: true, invoiceDate: true, totalTTC: true, currency: true },
    orderBy: { createdAt: "asc" },
  });
  return others.filter((o) => isDuplicatePair(inv, o));
}

/** Années présentes en base (pour les sélecteurs), ordre décroissant. */
export async function getAvailableYears(): Promise<number[]> {
  const rows = await prisma.invoice.findMany({ select: { invoiceDate: true } });
  const years = new Set<number>(rows.map((r) => r.invoiceDate.getFullYear()));
  years.add(new Date().getFullYear());
  return [...years].sort((a, b) => b - a);
}

/** Liste des tiers avec, pour chacun, le nombre de factures et les totaux HT. */
export async function getPartiesWithStats() {
  const parties = await prisma.party.findMany({ orderBy: { name: "asc" } });
  const grouped = await prisma.invoice.groupBy({
    by: ["partyId", "direction", "documentType"],
    _sum: { totalHT: true },
    _count: { _all: true },
    where: { partyId: { not: null } },
  });

  return parties.map((p) => {
    const rows = grouped.filter((g) => g.partyId === p.id);
    const sum = (dir: string) =>
      rows
        .filter((r) => r.direction === dir)
        .reduce((s, r) => s + (r._sum.totalHT ?? 0) * (r.documentType === "avoir" ? -1 : 1), 0);
    return {
      ...p,
      invoiceCount: rows.reduce((s, r) => s + r._count._all, 0),
      totalAchatsHT: Math.round(sum("achat") * 100) / 100,
      totalVentesHT: Math.round(sum("vente") * 100) / 100,
    };
  });
}

export async function getParty(id: string) {
  return prisma.party.findUnique({
    where: { id },
    include: {
      invoices: {
        orderBy: { invoiceDate: "desc" },
        select: {
          id: true, number: true, direction: true, documentType: true,
          invoiceDate: true, totalHT: true, totalTTC: true, currency: true, status: true,
        },
      },
    },
  });
}

/** Noms de tiers connus (pour l'autocomplétion des formulaires). */
export async function getPartyNames(): Promise<string[]> {
  const rows = await prisma.party.findMany({ select: { name: true }, orderBy: { name: "asc" } });
  return rows.map((r) => r.name);
}

/** Nombre de factures encore à traiter (à analyser / à vérifier / en erreur). */
export async function countToReview(): Promise<number> {
  return prisma.invoice.count({
    where: { status: { in: ["a_analyser", "analyse_en_cours", "a_verifier", "erreur"] } },
  });
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
