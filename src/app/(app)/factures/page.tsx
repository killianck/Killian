import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageHeader, Card, Money, StatusBadge, EmptyState, Badge } from "@/components/ui";
import { FactureFilters, type FilterValues } from "@/components/FactureFilters";
import { DeleteInvoiceButton } from "@/components/DeleteInvoiceButton";
import { deleteInvoice } from "./[id]/actions";
import { formatDate } from "@/lib/format";
import { getAvailableYears } from "@/lib/queries";
import { getCurrentUser } from "@/lib/auth";
import { duplicateIds } from "@/lib/invoices/duplicates";
import { buildInvoiceWhere, invoiceOrderBy } from "@/lib/invoices/filter";
import { AutoRefresh } from "@/components/AutoRefresh";

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
    statut: one(sp.statut),
  };

  const years = await getAvailableYears();
  const user = await getCurrentUser();
  const isAdmin = user?.role === "admin";

  const where = buildInvoiceWhere(f, years);
  let invoices = await prisma.invoice.findMany({
    where,
    orderBy: invoiceOrderBy(f.sort),
    include: { vatLines: true },
  });

  // --- Doublons ---
  // Calculés sur TOUTES les factures (pas seulement la liste filtrée) pour être fiables.
  const all = await prisma.invoice.findMany({
    select: { id: true, number: true, partyName: true, invoiceDate: true, totalTTC: true },
  });
  const dupIds = duplicateIds(all);
  if (f.onlyDuplicates === "1") {
    invoices = invoices.filter((inv) => dupIds.has(inv.id));
  }

  const analysing = invoices.filter((inv) => inv.status === "analyse_en_cours").length;

  return (
    <>
      <AutoRefresh active={analysing > 0} />
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

      {analysing > 0 && (
        <p className="mb-4 flex items-center gap-2 rounded-lg border border-[#dbe7ff] bg-[#eff4ff] px-3 py-2 text-xs text-[var(--primary)]">
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
          {analysing} facture{analysing > 1 ? "s" : ""} en cours d&apos;analyse — la page se met à jour toute seule.
        </p>
      )}

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
                    {inv.isStatement && (
                      <span className="ml-1.5 align-middle">
                        <Badge tone="info">relevé</Badge>
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
                      {isAdmin && (
                        <DeleteInvoiceButton action={deleteInvoice.bind(null, inv.id)} variant="icon" />
                      )}
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
