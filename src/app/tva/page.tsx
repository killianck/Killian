import Link from "next/link";
import { PageHeader, Card, Money, Disclaimer, EmptyState } from "@/components/ui";
import { TvaChart, type MonthlyPoint } from "@/components/TvaChart";
import { getInvoices, toAggregatable } from "@/lib/queries";
import { monthlyBreakdown, totalsForMonth, totalsForYear } from "@/lib/tva/aggregate";
import { MONTH_NAMES_FR, formatDate, formatMoney, formatMonthLabel } from "@/lib/format";
import { TVA_DISCLAIMER } from "@/lib/tva/rules";
import { DIRECTIONS, type Direction } from "@/lib/domain/enums";

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function TvaPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const now = new Date();
  const year = Number(one(sp.year)) || now.getFullYear();
  const month = Number(one(sp.month)) || now.getMonth() + 1;

  const invoices = await getInvoices();
  const agg = toAggregatable(invoices);

  const yearTotals = totalsForYear(agg, year);
  const months = monthlyBreakdown(agg, year);
  const monthTotals = totalsForMonth(agg, year, month);

  const monthInvoices = invoices
    .filter((i) => {
      const d = new Date(i.invoiceDate);
      return d.getFullYear() === year && d.getMonth() + 1 === month;
    })
    .sort((a, b) => +new Date(a.invoiceDate) - +new Date(b.invoiceDate));

  const years = [now.getFullYear() + 1, now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2];

  const chartData: MonthlyPoint[] = months.map((t, i) => ({
    mois: MONTH_NAMES_FR[i].slice(0, 3),
    collectee: t.collectedVat,
    deductible: t.deductibleVat,
    nette: t.netVat,
  }));

  const selectCls = "rounded-lg border border-[var(--border)] bg-white px-2.5 py-1.5 text-sm";

  return (
    <>
      <PageHeader title="TVA" subtitle="Vue mensuelle et annuelle. Résultats indicatifs." />

      <form method="get" className="mb-4 flex flex-wrap items-end gap-2">
        <label className="text-xs text-[var(--muted)]">
          Année
          <select name="year" defaultValue={year} className={`${selectCls} ml-2`}>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
        <label className="text-xs text-[var(--muted)]">
          Mois
          <select name="month" defaultValue={month} className={`${selectCls} ml-2`}>
            {MONTH_NAMES_FR.map((n, i) => <option key={i} value={i + 1}>{n}</option>)}
          </select>
        </label>
        <button type="submit" className="rounded-lg bg-[var(--foreground)] px-3 py-1.5 text-sm text-white">
          Afficher
        </button>
      </form>

      {/* ---------- Vue mensuelle ---------- */}
      <Card className="mb-6 p-4">
        <h2 className="mb-3 text-sm font-semibold">Vue mensuelle — {formatMonthLabel(year, month)}</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <table className="data-table">
            <tbody>
              <tr><td>TVA collectée</td><td className="num"><Money value={monthTotals.collectedVat} /></td></tr>
              <tr><td>TVA déductible</td><td className="num"><Money value={monthTotals.deductibleVat} /></td></tr>
              <tr className="font-semibold">
                <td>TVA nette estimée</td><td className="num"><Money value={monthTotals.netVat} /></td>
              </tr>
              <tr><td>Total HT</td><td className="num"><Money value={monthTotals.totalHT} /></td></tr>
              <tr><td>Total TTC</td><td className="num"><Money value={monthTotals.totalTTC} /></td></tr>
              <tr><td>Nombre de factures</td><td className="num">{monthTotals.count}</td></tr>
            </tbody>
          </table>
          <div className="text-xs text-[var(--muted)]">
            <p className="mb-2">
              TVA nette = TVA collectée − TVA déductible.
              {monthTotals.netVat >= 0
                ? " Montant positif : TVA à reverser (estimation)."
                : " Montant négatif : crédit de TVA (estimation)."}
            </p>
            <Disclaimer>{TVA_DISCLAIMER}</Disclaimer>
          </div>
        </div>

        <h3 className="mb-2 mt-4 text-xs font-semibold text-[var(--muted)]">Factures du mois</h3>
        {monthInvoices.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Aucune facture ce mois-ci.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th><th>Numéro</th><th>Tiers</th><th>Sens</th>
                  <th className="num">HT</th><th className="num">TVA</th><th className="num">TTC</th>
                </tr>
              </thead>
              <tbody>
                {monthInvoices.map((i) => (
                  <tr key={i.id}>
                    <td className="whitespace-nowrap">{formatDate(i.invoiceDate)}</td>
                    <td>
                      <Link href={`/factures/${i.id}`} className="text-[var(--primary)] hover:underline">
                        {i.number ?? "—"}
                      </Link>
                    </td>
                    <td className="max-w-44 truncate">{i.partyName ?? "—"}</td>
                    <td className="text-xs">{DIRECTIONS[i.direction as Direction]}{i.documentType === "avoir" ? " (avoir)" : ""}</td>
                    <td className="num"><Money value={i.totalHT} currency={i.currency} /></td>
                    <td className="num"><Money value={i.totalVAT} currency={i.currency} /></td>
                    <td className="num"><Money value={i.totalTTC} currency={i.currency} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ---------- Vue annuelle ---------- */}
      <Card className="mb-6 p-4">
        <h2 className="mb-3 text-sm font-semibold">Vue annuelle — {year}</h2>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Mois</th>
                <th className="num">TVA collectée</th>
                <th className="num">TVA déductible</th>
                <th className="num">TVA nette</th>
                <th className="num">Total HT</th>
                <th className="num">Total TTC</th>
                <th className="num">Factures</th>
              </tr>
            </thead>
            <tbody>
              {months.map((t, i) => (
                <tr key={i}>
                  <td>{MONTH_NAMES_FR[i]}</td>
                  <td className="num">{formatMoney(t.collectedVat)}</td>
                  <td className="num">{formatMoney(t.deductibleVat)}</td>
                  <td className="num">{formatMoney(t.netVat)}</td>
                  <td className="num">{formatMoney(t.totalHT)}</td>
                  <td className="num">{formatMoney(t.totalTTC)}</td>
                  <td className="num">{t.count}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold">
                <td>TOTAL {year}</td>
                <td className="num">{formatMoney(yearTotals.collectedVat)}</td>
                <td className="num">{formatMoney(yearTotals.deductibleVat)}</td>
                <td className="num">{formatMoney(yearTotals.netVat)}</td>
                <td className="num">{formatMoney(yearTotals.totalHT)}</td>
                <td className="num">{formatMoney(yearTotals.totalTTC)}</td>
                <td className="num">{yearTotals.count}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="mb-3 text-sm font-semibold">Graphique annuel — {year}</h2>
        {yearTotals.count === 0 ? (
          <EmptyState>Aucune donnée pour {year}.</EmptyState>
        ) : (
          <TvaChart data={chartData} />
        )}
      </Card>
    </>
  );
}
