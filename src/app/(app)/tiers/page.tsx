import Link from "next/link";
import { PageHeader, Card, Money, Badge, EmptyState } from "@/components/ui";
import { getPartiesWithStats } from "@/lib/queries";
import { PARTY_KINDS, normalizePartyName, type PartyKind } from "@/lib/invoices/party";

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function TiersPage({ searchParams }: { searchParams: Promise<SP> }) {
  const rawQ = one((await searchParams).q);
  const q = normalizePartyName(rawQ);
  let parties = await getPartiesWithStats();
  if (q) parties = parties.filter((p) => normalizePartyName(p.name).includes(q));

  return (
    <>
      <PageHeader
        title="Tiers"
        subtitle="Fournisseurs et clients. Les coordonnées sont réutilisées automatiquement d'une facture à l'autre."
      />

      <Card className="mb-4 p-3">
        <form method="get">
          <input
            type="text"
            name="q"
            defaultValue={rawQ}
            placeholder="Rechercher un tiers"
            className="w-full max-w-sm rounded-lg border border-[var(--border)] bg-white px-2.5 py-1.5 text-sm"
          />
        </form>
      </Card>

      {parties.length === 0 ? (
        <EmptyState>
          Aucun tiers pour l&apos;instant. Les fiches se créent automatiquement à l&apos;import ou à la
          saisie d&apos;une facture.
        </EmptyState>
      ) : (
        <Card className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Type</th>
                <th>SIRET</th>
                <th className="num">Factures</th>
                <th className="num">Achats (HT)</th>
                <th className="num">Ventes (HT)</th>
              </tr>
            </thead>
            <tbody>
              {parties.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link href={`/tiers/${p.id}`} className="font-medium text-[var(--primary)] hover:underline">
                      {p.name}
                    </Link>
                  </td>
                  <td className="text-xs">
                    <Badge tone={p.kind === "client" ? "info" : "neutral"}>
                      {PARTY_KINDS[p.kind as PartyKind] ?? p.kind}
                    </Badge>
                  </td>
                  <td className="text-xs">{p.siret ?? "—"}</td>
                  <td className="num">{p.invoiceCount}</td>
                  <td className="num">{p.totalAchatsHT ? <Money value={p.totalAchatsHT} /> : "—"}</td>
                  <td className="num">{p.totalVentesHT ? <Money value={p.totalVentesHT} /> : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
