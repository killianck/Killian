import { PageHeader, Card, Money } from "@/components/ui";
import { AnnualBarChart } from "@/components/TvaChart";
import { getInvoices, toAggregatable } from "@/lib/queries";
import { totalsForYear } from "@/lib/tva/aggregate";

export const dynamic = "force-dynamic";

export default async function RapportsPage() {
  const invoices = await getInvoices();
  const agg = toAggregatable(invoices);
  const now = new Date().getFullYear();
  const years = [now - 2, now - 1, now];
  const perYear = years.map((y) => ({ year: y, totals: totalsForYear(agg, y) }));
  const chart = perYear.map((p) => ({ annee: String(p.year), nette: p.totals.netVat }));

  return (
    <>
      <PageHeader title="Rapports" subtitle="Export des données et synthèses pluriannuelles." />

      <Card className="mb-6 p-4">
        <h2 className="mb-2 text-sm font-semibold">Export Excel</h2>
        <p className="mb-3 text-sm text-[var(--muted)]">
          Télécharge un fichier .xlsx avec une ligne par facture (date, numéro, tiers, type,
          catégorie, HT, TVA, TTC, taux, mois, année).
        </p>
        <div className="flex flex-wrap gap-2">
          <a href="/api/export/factures" className="rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-medium text-white">
            Toutes les factures
          </a>
          <a href={`/api/export/factures?year=${now}`} className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm">
            Année {now}
          </a>
          <a href={`/api/export/factures?year=${now}&direction=achat`} className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm">
            Achats {now}
          </a>
          <a href={`/api/export/factures?year=${now}&direction=vente`} className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm">
            Ventes {now}
          </a>
        </div>
        <p className="mt-3 text-xs text-[var(--muted)]">
          D&apos;autres exports (formats comptables) pourront être ajoutés ici plus tard.
        </p>
      </Card>

      <Card className="mb-6 p-4">
        <h2 className="mb-3 text-sm font-semibold">TVA nette estimée par année</h2>
        <AnnualBarChart data={chart} />
      </Card>

      <Card className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Année</th>
              <th className="num">TVA collectée</th>
              <th className="num">TVA déductible</th>
              <th className="num">TVA nette estimée</th>
              <th className="num">Total HT</th>
              <th className="num">Total TTC</th>
              <th className="num">Factures</th>
            </tr>
          </thead>
          <tbody>
            {perYear.map(({ year, totals }) => (
              <tr key={year}>
                <td>{year}</td>
                <td className="num"><Money value={totals.collectedVat} /></td>
                <td className="num"><Money value={totals.deductibleVat} /></td>
                <td className="num"><Money value={totals.netVat} /></td>
                <td className="num"><Money value={totals.totalHT} /></td>
                <td className="num"><Money value={totals.totalTTC} /></td>
                <td className="num">{totals.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
