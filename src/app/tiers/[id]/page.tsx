import Link from "next/link";
import { notFound } from "next/navigation";
import { getParty } from "@/lib/queries";
import { PageHeader, Card, Money, StatusBadge } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { DIRECTIONS, type Direction } from "@/lib/domain/enums";
import { DeleteInvoiceButton } from "@/components/DeleteInvoiceButton";
import { PartyForm } from "./PartyForm";
import { deleteParty } from "./actions";

export const dynamic = "force-dynamic";

export default async function PartyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const party = await getParty(id);
  if (!party) notFound();

  return (
    <>
      <PageHeader
        title={party.name}
        subtitle={`${party.invoices.length} facture${party.invoices.length > 1 ? "s" : ""} liée${party.invoices.length > 1 ? "s" : ""}`}
        action={
          <Link href="/tiers" className="text-sm text-[var(--muted)]">← Tous les tiers</Link>
        }
      />

      <Card className="mb-4 p-6">
        <h2 className="mb-3 text-sm font-semibold">Coordonnées</h2>
        <PartyForm party={party} />
      </Card>

      <Card className="mb-4 overflow-x-auto">
        <h2 className="p-4 pb-0 text-sm font-semibold">Factures de ce tiers</h2>
        {party.invoices.length === 0 ? (
          <p className="p-4 text-sm text-[var(--muted)]">Aucune facture liée.</p>
        ) : (
          <table className="data-table mt-2">
            <thead>
              <tr>
                <th>Date</th>
                <th>Numéro</th>
                <th>Sens</th>
                <th className="num">HT</th>
                <th className="num">TTC</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {party.invoices.map((inv) => (
                <tr key={inv.id}>
                  <td className="whitespace-nowrap">{formatDate(inv.invoiceDate)}</td>
                  <td>
                    <Link href={`/factures/${inv.id}`} className="text-[var(--primary)] hover:underline">
                      {inv.number ?? "—"}
                    </Link>
                    {inv.documentType === "avoir" && (
                      <span className="ml-1 text-xs text-[var(--muted)]">(avoir)</span>
                    )}
                  </td>
                  <td className="text-xs">{DIRECTIONS[inv.direction as Direction]}</td>
                  <td className="num"><Money value={inv.totalHT} currency={inv.currency} /></td>
                  <td className="num"><Money value={inv.totalTTC} currency={inv.currency} /></td>
                  <td><StatusBadge status={inv.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold">Supprimer ce tiers</h2>
            <p className="text-xs text-[var(--muted)]">
              Les factures liées ne sont pas supprimées : elles gardent le nom «&nbsp;{party.name}&nbsp;»
              mais ne sont plus rattachées à une fiche.
            </p>
          </div>
          <DeleteInvoiceButton
            action={deleteParty.bind(null, party.id)}
            label="Supprimer ce tiers"
            confirmText={`Supprimer la fiche « ${party.name} » ? Les factures liées sont conservées.`}
          />
        </div>
      </Card>
    </>
  );
}
