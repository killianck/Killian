// Construction du filtre Prisma pour la liste des factures.
// Isolé ici pour pouvoir être testé.

import { validMonth, validYear } from "@/lib/domain/dateParams";

export type InvoiceFilterParams = {
  q: string;
  year: string;
  month: string;
  direction: string;
  type: string;
  category: string;
  rate: string;
  sort: string;
  statut?: string;
};

export type PrismaWhere = Record<string, unknown>;

/** Renvoie le `where` Prisma (tout regroupé dans un AND pour se combiner librement). */
export function buildInvoiceWhere(p: InvoiceFilterParams, availableYears: number[]): PrismaWhere {
  const and: PrismaWhere[] = [];

  const q = p.q.trim();
  if (q) {
    and.push({
      OR: [
        { partyName: { contains: q } },
        { number: { contains: q } },
        { notes: { contains: q } },
      ],
    });
  }
  if (p.direction) and.push({ direction: p.direction });
  if (p.type) and.push({ documentType: p.type });
  if (p.category) and.push({ category: p.category });
  // Un taux non numérique (URL modifiée à la main, lien périmé) donnerait NaN,
  // que Prisma refuse : le filtre est simplement ignoré, jamais fatal.
  if (p.rate) {
    const rate = Number(p.rate);
    if (Number.isFinite(rate)) and.push({ vatLines: { some: { rate } } });
  }

  switch (p.statut) {
    case "a_traiter":
      and.push({ status: { in: ["a_analyser", "analyse_en_cours", "a_verifier", "erreur"] } });
      break;
    case "a_verifier":
    case "validee":
      and.push({ status: p.statut });
      break;
    case "incoherent":
      and.push({ coherence: "incoherent" });
      break;
  }

  // Dates stockées à minuit UTC : bornes calculées en UTC (cf. aggregate.ts).
  const utc = (yy: number, mm: number) => new Date(Date.UTC(yy, mm, 1));
  // Année / mois hors plage (ou non numériques) : filtre ignoré. Sans ce garde-fou,
  // `?year=1e999` construisait une Date invalide et faisait échouer toute la page.
  const y = validYear(p.year);
  const m = validMonth(p.month);
  if (y && m) {
    and.push({ invoiceDate: { gte: utc(y, m - 1), lt: utc(y, m) } });
  } else if (y) {
    and.push({ invoiceDate: { gte: utc(y, 0), lt: utc(y + 1, 0) } });
  } else if (m) {
    // mois seul : ce mois pour toutes les années présentes
    and.push({
      OR: availableYears.map((yy) => ({
        invoiceDate: { gte: utc(yy, m - 1), lt: utc(yy, m) },
      })),
    });
  }

  return and.length ? { AND: and } : {};
}

export function invoiceOrderBy(sort: string) {
  switch (sort) {
    case "date_asc":
      return { invoiceDate: "asc" as const };
    case "ttc_desc":
      return { totalTTC: "desc" as const };
    case "ttc_asc":
      return { totalTTC: "asc" as const };
    default:
      return { invoiceDate: "desc" as const };
  }
}
