import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageHeader, Card, Money, StatusBadge, CoherenceBadge, EmptyState } from "@/components/ui";
import { formatDate, formatRate, MONTH_NAMES_FR } from "@/lib/format";
import {
  CATEGORIES,
  DIRECTIONS,
  DOCUMENT_TYPES,
  labelOf,
  type Direction,
} from "@/lib/domain/enums";
import { VAT_RATES } from "@/lib/tva/rules";
import { getAvailableYears } from "@/lib/queries";

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function FacturesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const q = one(sp.q).trim();
  const year = one(sp.year);
  const month = one(sp.month);
  const direction = one(sp.direction);
  const documentType = one(sp.type);
  const category = one(sp.category);
  const rate = one(sp.rate);
  const sort = one(sp.sort) || "date_desc";

  const years = await getAvailableYears();

  // --- Construction du filtre Prisma ---
  const where: Record<string, unknown> = {};
  if (q) {
    where.OR = [
      { partyName: { contains: q } },
      { number: { contains: q } },
      { notes: { contains: q } },
    ];
  }
  if (direction) where.direction = direction;
  if (documentType) where.documentType = documentType;
  if (category) where.category = category;
  if (rate) where.vatLines = { some: { rate: Number(rate) } };
  if (year) {
    const y = Number(year);
    const m = month ? Number(month) : null;
    const start = m ? new Date(y, m - 1, 1) : new Date(y, 0, 1);
    const end = m ? new Date(y, m, 1) : new Date(y + 1, 0, 1);
    where.invoiceDate = { gte: start, lt: end };
  }

  const orderBy =
    sort === "date_asc" ? { invoiceDate: "asc" as const }
    : sort === "ttc_desc" ? { totalTTC: "desc" as const }
    : sort === "ttc_asc" ? { totalTTC: "asc" as const }
    : { invoiceDate: "desc" as const };

  const invoices = await prisma.invoice.findMany({ where, orderBy, include: { vatLines: true } });

  const selectCls =
    "rounded-lg border border-[var(--border)] bg-white px-2.5 py-1.5 text-sm";

  return (
    <>
      <PageHeader
        title="Factures"
        subtitle={`${invoices.length} facture${invoices.length > 1 ? "s" : ""}`}
        action={
          <div className="flex items-center gap-2">
            <Link
              href="/factures/nouvelle"
              className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium"
            >
              Saisir une facture
            </Link>
            <Link
              href="/factures/importer"
              className="rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-medium text-white"
            >
              + Importer un PDF
            </Link>
          </div>
        }
      />

      <Card className="mb-4 p-3">
        <form method="get" className="flex flex-wrap items-end gap-2">
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Rechercher (fournisseur, n°, note)"
            className={`${selectCls} min-w-56 flex-1`}
          />
          <select name="year" defaultValue={year} className={selectCls}>
            <option value="">Toutes années</option>
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <select name="month" defaultValue={month} className={selectCls}>
            <option value="">Tous mois</option>
            {MONTH_NAMES_FR.map((n, i) => (
              <option key={i} value={i + 1}>{n}</option>
            ))}
          </select>
          <select name="direction" defaultValue={direction} className={selectCls}>
            <option value="">Achat / Vente</option>
            {Object.entries(DIRECTIONS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <select name="type" defaultValue={documentType} className={selectCls}>
            <option value="">Tous types</option>
            {Object.entries(DOCUMENT_TYPES).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <select name="category" defaultValue={category} className={selectCls}>
            <option value="">Toutes catégories</option>
            {Object.entries(CATEGORIES).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <select name="rate" defaultValue={rate} className={selectCls}>
            <option value="">Tous taux TVA</option>
            {VAT_RATES.map((r) => (
              <option key={r.rate} value={r.rate}>{r.label}</option>
            ))}
          </select>
          <select name="sort" defaultValue={sort} className={selectCls}>
            <option value="date_desc">Date ↓</option>
            <option value="date_asc">Date ↑</option>
            <option value="ttc_desc">Montant ↓</option>
            <option value="ttc_asc">Montant ↑</option>
          </select>
          <button type="submit" className="rounded-lg bg-[var(--foreground)] px-3 py-1.5 text-sm text-white">
            Filtrer
          </button>
          <Link href="/factures" className="px-2 py-1.5 text-sm text-[var(--muted)]">
            Réinitialiser
          </Link>
        </form>
      </Card>

      {invoices.length === 0 ? (
        <EmptyState>Aucune facture ne correspond à ces critères.</EmptyState>
      ) : (
        <Card className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Numéro</th>
                <th>Fournisseur / Client</th>
                <th>Type</th>
                <th>Catégorie</th>
                <th className="num">HT</th>
                <th className="num">TVA</th>
                <th className="num">TTC</th>
                <th>Taux</th>
                <th>Statut</th>
                <th>Contrôle</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td className="whitespace-nowrap">{formatDate(inv.invoiceDate)}</td>
                  <td>
                    <Link href={`/factures/${inv.id}`} className="font-medium text-[var(--primary)] hover:underline">
                      {inv.number ?? "—"}
                    </Link>
                  </td>
                  <td className="max-w-48 truncate">{inv.partyName ?? "—"}</td>
                  <td className="whitespace-nowrap text-xs">
                    {DOCUMENT_TYPES[inv.documentType as keyof typeof DOCUMENT_TYPES]}
                    <span className="text-[var(--muted)]"> · {DIRECTIONS[inv.direction as Direction]}</span>
                  </td>
                  <td className="text-xs">{labelOf(CATEGORIES, inv.category)}</td>
                  <td className="num"><Money value={inv.totalHT} currency={inv.currency} /></td>
                  <td className="num"><Money value={inv.totalVAT} currency={inv.currency} /></td>
                  <td className="num"><Money value={inv.totalTTC} currency={inv.currency} /></td>
                  <td className="whitespace-nowrap text-xs">
                    {[...new Set(inv.vatLines.map((l) => l.rate))].map((r) => formatRate(r)).join(" / ") || "—"}
                  </td>
                  <td><StatusBadge status={inv.status} /></td>
                  <td><CoherenceBadge level={inv.coherence} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
