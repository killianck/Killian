import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageHeader, Card, Money, EmptyState, Badge } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { DIRECTIONS, type Direction } from "@/lib/domain/enums";
import { getAvailableYears } from "@/lib/queries";

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

function range(period: string, year: string, from: string, to: string) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (period) {
    case "mois":
      return { gte: new Date(y, m, 1), lt: new Date(y, m + 1, 1) };
    case "mois_suivant":
      return { gte: new Date(y, m + 1, 1), lt: new Date(y, m + 2, 1) };
    case "annee": {
      const yy = year ? Number(year) : y;
      return { gte: new Date(yy, 0, 1), lt: new Date(yy + 1, 0, 1) };
    }
    case "perso": {
      const g = from ? new Date(from) : new Date(y, m, 1);
      const l = to ? new Date(to) : new Date(y, m + 1, 1);
      return { gte: g, lt: l };
    }
    default: {
      // "à venir" : à partir d'aujourd'hui
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return { gte: today };
    }
  }
}

export default async function EcheancesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const period = one(sp.period) || "avenir";
  const year = one(sp.year);
  const from = one(sp.from);
  const to = one(sp.to);

  const years = await getAvailableYears();
  const dueDate = range(period, year, from, to);

  const invoices = await prisma.invoice.findMany({
    where: { dueDate: { not: null, ...dueDate } },
    orderBy: { dueDate: "asc" },
    select: {
      id: true, number: true, partyName: true, direction: true,
      invoiceDate: true, dueDate: true, totalTTC: true, currency: true, documentType: true,
    },
  });

  const withDue = invoices.length;
  const noDue = await prisma.invoice.count({ where: { dueDate: null } });

  const selectCls = "rounded-lg border border-[var(--border)] bg-white px-2.5 py-1.5 text-sm";

  return (
    <>
      <PageHeader
        title="Échéances"
        subtitle="Dates de règlement prévues selon les factures — information seule, aucun suivi de paiement."
      />

      <Card className="mb-4 p-3">
        <form method="get" className="flex flex-wrap items-end gap-2">
          <select name="period" defaultValue={period} className={selectCls}>
            <option value="avenir">À venir</option>
            <option value="mois">Mois en cours</option>
            <option value="mois_suivant">Mois suivant</option>
            <option value="annee">Année…</option>
            <option value="perso">Période personnalisée…</option>
          </select>
          <select name="year" defaultValue={year} className={selectCls}>
            <option value="">Année (si « Année… »)</option>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <label className="text-xs text-[var(--muted)]">
            Du <input type="date" name="from" defaultValue={from} className={selectCls} />
          </label>
          <label className="text-xs text-[var(--muted)]">
            au <input type="date" name="to" defaultValue={to} className={selectCls} />
          </label>
          <button type="submit" className="rounded-lg bg-[var(--foreground)] px-3 py-1.5 text-sm text-white">
            Appliquer
          </button>
        </form>
      </Card>

      <div className="mb-3 flex gap-2 text-xs text-[var(--muted)]">
        <Badge tone="info">{withDue} échéance{withDue > 1 ? "s" : ""} affichée{withDue > 1 ? "s" : ""}</Badge>
        <Badge>{noDue} facture{noDue > 1 ? "s" : ""} sans échéance indiquée</Badge>
      </div>

      {invoices.length === 0 ? (
        <EmptyState>Aucune échéance sur cette période.</EmptyState>
      ) : (
        <Card className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Facture</th>
                <th>Fournisseur / Client</th>
                <th>Date de facture</th>
                <th>Échéance</th>
                <th className="num">Montant TTC</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td>
                    <Link href={`/factures/${inv.id}`} className="font-medium text-[var(--primary)] hover:underline">
                      {inv.number ?? "—"}
                    </Link>
                    <span className="ml-2 text-xs text-[var(--muted)]">{DIRECTIONS[inv.direction as Direction]}</span>
                  </td>
                  <td>{inv.partyName ?? "—"}</td>
                  <td className="whitespace-nowrap">{formatDate(inv.invoiceDate)}</td>
                  <td className="whitespace-nowrap font-medium">{formatDate(inv.dueDate)}</td>
                  <td className="num"><Money value={inv.totalTTC} currency={inv.currency} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
