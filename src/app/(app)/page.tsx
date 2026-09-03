import Link from "next/link";
import { PageHeader, StatCard, Card, Money, Disclaimer } from "@/components/ui";
import { TvaChart, type MonthlyPoint } from "@/components/TvaChart";
import { PeriodNav } from "@/components/PeriodNav";
import { countToReview, getInvoices, getUpcomingDueDates, toAggregatable } from "@/lib/queries";
import { monthlyBreakdown, totalsForMonth, totalsForYear } from "@/lib/tva/aggregate";
import { MONTH_NAMES_FR, formatDate, formatMoney } from "@/lib/format";
import { TVA_DISCLAIMER } from "@/lib/tva/rules";
import { DIRECTIONS, type Direction } from "@/lib/domain/enums";

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const now = new Date();

  const yParam = Number(one(sp.year));
  const mParam = Number(one(sp.month));
  const year = Number.isInteger(yParam) && yParam >= 2000 && yParam <= 2100 ? yParam : now.getFullYear();
  const month = Number.isInteger(mParam) && mParam >= 1 && mParam <= 12 ? mParam : now.getMonth() + 1;
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;

  const invoices = await getInvoices();
  const agg = toAggregatable(invoices);

  const m = totalsForMonth(agg, year, month);
  const y = totalsForYear(agg, year);
  const months = monthlyBreakdown(agg, year);
  const upcoming = await getUpcomingDueDates(6);
  const toReview = await countToReview();

  const chartData: MonthlyPoint[] = months.map((t, i) => ({
    mois: MONTH_NAMES_FR[i].slice(0, 3),
    collectee: t.collectedVat,
    deductible: t.deductibleVat,
    nette: t.netVat,
  }));

  return (
    <>
      <PageHeader
        title="Tableau de bord"
        subtitle="Vue d'ensemble des factures et de la TVA"
      />

      {toReview > 0 && (
        <Link
          href="/factures?statut=a_traiter"
          className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-[var(--warning-bg)] bg-[var(--warning-bg)] px-4 py-3 text-sm text-[var(--warning)]"
        >
          <span>
            <strong>{toReview}</strong> facture{toReview > 1 ? "s" : ""} à vérifier ou à compléter.
            Elles sont déjà incluses dans les totaux ci-dessous — leurs montants peuvent encore changer.
          </span>
          <span className="shrink-0 font-medium underline">Les traiter →</span>
        </Link>
      )}
      {(m.excludedCount > 0 || y.excludedCount > 0) && (
        <p className="mb-4 rounded-lg border border-[var(--danger-bg)] bg-[var(--danger-bg)] px-3 py-2 text-xs text-[var(--danger)]">
          ⚠️ {Math.max(m.excludedCount, y.excludedCount)} facture(s) exclue(s) des totaux faute de date
          ou de montant exploitable — corrigez-les dans la liste des factures.
        </p>
      )}

      <section className="mb-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-[var(--muted)]">
            {isCurrentMonth ? "Mois en cours" : "Mois sélectionné"}
          </h2>
          <PeriodNav year={year} month={month} />
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <StatCard label="TVA collectée" value={formatMoney(m.collectedVat)} hint="Sur les ventes" />
          <StatCard label="TVA déductible" value={formatMoney(m.deductibleVat)} hint="Sur les achats" />
          <StatCard
            label="TVA nette estimée"
            value={formatMoney(m.netVat)}
            tone={m.netVat >= 0 ? "negative" : "positive"}
            hint={m.netVat >= 0 ? "À reverser (estimation)" : "Crédit de TVA (estimation)"}
          />
          <StatCard label="Factures" value={String(m.count)} />
          <StatCard label="Total HT" value={formatMoney(m.totalHT)} />
          <StatCard label="Total TTC" value={formatMoney(m.totalTTC)} />
        </div>
      </section>

      <section className="mb-6 mt-6">
        <h2 className="mb-2 text-sm font-semibold text-[var(--muted)]">Année {year}</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <StatCard label="TVA collectée" value={formatMoney(y.collectedVat)} />
          <StatCard label="TVA déductible" value={formatMoney(y.deductibleVat)} />
          <StatCard label="TVA nette estimée" value={formatMoney(y.netVat)} tone={y.netVat >= 0 ? "negative" : "positive"} />
          <StatCard label="Factures" value={String(y.count)} />
          <StatCard label="Total HT" value={formatMoney(y.totalHT)} />
          <StatCard label="Total TTC" value={formatMoney(y.totalTTC)} />
        </div>
      </section>

      <Card className="mb-6 p-4">
        <h2 className="mb-3 text-sm font-semibold text-[var(--foreground)]">
          Évolution mensuelle de la TVA — {year}
        </h2>
        <TvaChart data={chartData} />
        <div className="mt-3">
          <Disclaimer>{TVA_DISCLAIMER}</Disclaimer>
        </div>
      </Card>

      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--foreground)]">Prochaines échéances</h2>
          <Link href="/echeances" className="text-xs font-medium text-[var(--primary)]">
            Tout voir
          </Link>
        </div>
        {upcoming.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Aucune échéance à venir.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {upcoming.map((inv) => (
              <li key={inv.id} className="flex items-center justify-between py-2 text-sm">
                <span className="text-[var(--muted)]">{formatDate(inv.dueDate)}</span>
                <Link href={`/factures/${inv.id}`} className="mx-3 flex-1 truncate hover:underline">
                  {inv.partyName ?? "—"}
                  <span className="ml-2 text-xs text-[var(--muted)]">
                    {inv.number} · {DIRECTIONS[inv.direction as Direction]}
                  </span>
                </Link>
                <Money value={inv.totalTTC} currency={inv.currency} />
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-[11px] text-[var(--muted)]">
          Information seule : aucun suivi de paiement, aucune alerte.
        </p>
      </Card>
    </>
  );
}
