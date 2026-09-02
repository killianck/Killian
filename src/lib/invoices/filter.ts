// Construction du filtre Prisma pour la liste des factures.
// Isolé ici pour pouvoir être testé.

export type InvoiceFilterParams = {
  q: string;
  year: string;
  month: string;
  direction: string;
  type: string;
  category: string;
  rate: string;
  sort: string;
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
  if (p.rate) and.push({ vatLines: { some: { rate: Number(p.rate) } } });

  const y = p.year ? Number(p.year) : null;
  const m = p.month ? Number(p.month) : null;
  if (y && m) {
    and.push({ invoiceDate: { gte: new Date(y, m - 1, 1), lt: new Date(y, m, 1) } });
  } else if (y) {
    and.push({ invoiceDate: { gte: new Date(y, 0, 1), lt: new Date(y + 1, 0, 1) } });
  } else if (m) {
    // mois seul : ce mois pour toutes les années présentes
    and.push({
      OR: availableYears.map((yy) => ({
        invoiceDate: { gte: new Date(yy, m - 1, 1), lt: new Date(yy, m, 1) },
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
