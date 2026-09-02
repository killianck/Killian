import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageHeader, Card, Money, StatusBadge, EmptyState, Badge } from "@/components/ui";
import { FactureFilters, type FilterValues } from "@/components/FactureFilters";
import { DeleteInvoiceButton } from "@/components/DeleteInvoiceButton";
import { deleteInvoice } from "./[id]/actions";
import { formatDate } from "@/lib/format";
import { getAvailableYears } from "@/lib/queries";
import { duplicateIds } from "@/lib/invoices/duplicates";

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function FacturesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const f: FilterValues = {
    q: one(sp.q).trim(),
    year: one(sp.year),
    month: one(sp.month),
    direction: one(sp.direction),
    type: one(sp.type),
    category: one(sp.category),
    rate: one(sp.rate),
    sort: one(sp.sort) || "date_desc",
    onlyDuplicates: one(sp.doublons),
  };

  const years = await getAvailableYears();

  // --- Filtre Prisma (tout dans un AND pour combiner librement) ---
  const and: Record<string, unknown>[] = [];
  if (f.q) {
    and.push({
      OR: [
        { partyName: { contains: f.q } },
        { number: { contains: f.q } },
        { notes: { contains: f.q } },
      ],
    });
  }
  if (f.direction) and.push({ direction: f.direction });
  if (f.type) and.push({ documentType: f.type });
  if (f.category) and.push({ category: f.category });
  if (f.rate) and.push({ vatLines: { some: { rate: Number(f.rate) } } });

  // Dates : année + mois, ou année seule, ou mois seul (toutes les années)
  const y = f.year ? Number(f.year) : null;
  const m = f.month ? Number(f.month) : null;
  if (y && m) {
    and.push({ invoiceDate: { gte: new Date(y, m - 1, 1), lt: new Date(y, m, 1) } });
  } else if (y) {
    and.push({ invoiceDate: { gte: new Date(y, 0, 1), lt: new Date(y + 1, 0, 1) } });
  } else if (m) {
    and.push({
      OR: years.map((yy) => ({
        invoiceDate: { gte: new Date(yy, m - 1, 1), lt: new Date(yy, m, 1) },
      })),
    });
  }

  const orderBy =
    f.sort === "date_asc" ? { invoiceDate: "asc" as const }
    : f.sort === "ttc_desc" ? { totalTTC: "desc" as const }
    : f.sort === "ttc_asc" ? { totalTTC: "asc" as const }
    : { invoiceDate: "desc" as const };

  const where = and.length ? { AND: and } : {};
  let invoices = await prisma.invoice.findMany({ where, orderBy, include: { vatLines: true } });

  // --- Doublons ---
  // Calculés sur TOUTES les factures (pas seulement la liste filtrée) pour être fiables.
  const all = await prisma.invoice.findMany({
    select: { id: true, number: true, partyName: true, invoiceDate: true, totalTTC: true },
  });
  const dupIds = duplicateIds(all);
  if (f.onlyDuplicates === "1") {
    invoices = invoices.filter((inv) => dupIds.has(inv.id));
  }

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

      {dupIds.size > 0 && f.onlyDuplicates !== "1" && (
        <Link
          href="/factures?doublons=1"
          className="mb-4 flex items-center gap-2 rounded-lg border border-[var(--warning-bg)] bg-[var(--warning-bg)] px-3 py-2 text-xs text-[var(--warning)]"
        >
          ⚠️ {dupIds.size} facture{dupIds.size > 1 ? "s" : ""} en doublon potentiel — cliquez pour les afficher.
        </Link>
      )}

      <Card className="mb-4 p-3">
        <FactureFilters values={f} years={years} />
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
                <th>Sens</th>
                <th className="num">HT</th>
                <th className="num">TVA</th>
                <th className="num">TTC</th>
                <th>Statut</th>
                <th className="actions"></th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td className="whitespace-nowrap">{formatDate(inv.invoiceDate)}</td>
                  <td className="whitespace-nowrap">
                    <Link href={`/factures/${inv.id}`} className="font-medium text-[var(--primary)] hover:underline">
                      {inv.number ?? "—"}
                    </Link>
                    {inv.documentType === "avoir" && (
                      <span className="ml-1.5 align-middle">
                        <Badge tone="info">avoir</Badge>
                      </span>
                    )}
                    {dupIds.has(inv.id) && (
                      <span className="ml-1.5 align-middle">
                        <Badge tone="warning">doublon&nbsp;?</Badge>
                      </span>
                    )}
                  </td>
                  <td>
                    <div className="max-w-[190px] truncate" title={inv.partyName ?? undefined}>
                      {inv.partyName ?? "—"}
                    </div>
                  </td>
                  <td className="whitespace-nowrap text-xs">
                    {inv.direction === "achat" ? "Achat" : "Vente"}
                  </td>
                  <td className="num"><Money value={inv.totalHT} currency={inv.currency} /></td>
                  <td className="num"><Money value={inv.totalVAT} currency={inv.currency} /></td>
                  <td className="num"><Money value={inv.totalTTC} currency={inv.currency} /></td>
                  <td className="whitespace-nowrap">
                    <StatusBadge status={inv.status} />
                    {inv.coherence !== "coherent" && (
                      <span
                        className="ml-1 align-middle"
                        title={inv.coherence === "incoherent" ? "Montants incohérents" : "Montants à vérifier"}
                      >
                        ⚠️
                      </span>
                    )}
                  </td>
                  <td className="actions">
                    <div className="flex items-center gap-0.5">
                      <Link
                        href={`/factures/${inv.id}/modifier`}
                        title="Modifier"
                        aria-label="Modifier la facture"
                        className="rounded-md px-1.5 py-1 hover:bg-[#f2f4f7]"
                      >
                        ✏️
                      </Link>
                      <DeleteInvoiceButton action={deleteInvoice.bind(null, inv.id)} variant="icon" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
