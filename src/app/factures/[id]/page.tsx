import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getInvoice } from "@/lib/queries";
import { PageHeader, Card, Money, StatusBadge, CoherenceBadge } from "@/components/ui";
import { formatDate, formatRate } from "@/lib/format";
import {
  CATEGORIES,
  DIRECTIONS,
  DOCUMENT_TYPES,
  invoiceKind,
  INVOICE_KINDS,
  labelOf,
  type Direction,
  type DocumentType,
} from "@/lib/domain/enums";
import { checkCoherence } from "@/lib/tva/coherence";

export const dynamic = "force-dynamic";

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const inv = await getInvoice(id);
  if (!inv) notFound();

  const report = checkCoherence({
    totalHT: inv.totalHT,
    totalVAT: inv.totalVAT,
    totalTTC: inv.totalTTC,
    vatLines: inv.vatLines,
  });

  const kind = invoiceKind(inv.documentType as DocumentType, inv.direction as Direction);

  const rows: [string, ReactNode][] = [
    ["Type de document", DOCUMENT_TYPES[inv.documentType as keyof typeof DOCUMENT_TYPES]],
    ["Classement", INVOICE_KINDS[kind]],
    ["Sens", DIRECTIONS[inv.direction as Direction]],
    ["Catégorie", labelOf(CATEGORIES, inv.category)],
    ["Numéro", inv.number ?? "—"],
    ["Date de facture", formatDate(inv.invoiceDate)],
    ["Date d'échéance", inv.dueDate ? formatDate(inv.dueDate) : "Échéance non indiquée"],
    [inv.direction === "achat" ? "Fournisseur" : "Client", inv.partyName ?? "—"],
    ["Adresse", inv.partyAddress ?? "—"],
    ["SIRET", inv.siret ?? "—"],
    ["TVA intracommunautaire", inv.vatNumber ?? "—"],
    ["Devise", inv.currency],
  ];

  return (
    <>
      <PageHeader
        title={`Facture ${inv.number ?? ""}`.trim()}
        subtitle={inv.partyName ?? undefined}
        action={
          <Link href="/factures" className="text-sm text-[var(--muted)]">
            ← Retour aux factures
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <StatusBadge status={inv.status} />
        <CoherenceBadge level={report.level} />
        {inv.status !== "validee" && (
          <span className="text-xs text-[var(--muted)]">
            (La validation manuelle et la modification seront ajoutées à l&apos;étape suivante.)
          </span>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-4 lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold">Informations</h2>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
            {rows.map(([label, value]) => (
              <div key={label} className="flex flex-col border-b border-[var(--border)] pb-1.5">
                <dt className="text-xs text-[var(--muted)]">{label}</dt>
                <dd className="text-sm">{value}</dd>
              </div>
            ))}
          </dl>
          {inv.notes && (
            <p className="mt-3 rounded-lg bg-[#f9fafb] p-3 text-sm text-[var(--muted)]">{inv.notes}</p>
          )}
        </Card>

        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold">Montants</h2>
          <div className="space-y-1.5 text-sm">
            <Row label="Total HT"><Money value={inv.totalHT} currency={inv.currency} /></Row>
            <Row label="Total TVA"><Money value={inv.totalVAT} currency={inv.currency} /></Row>
            <Row label="Total TTC" strong><Money value={inv.totalTTC} currency={inv.currency} /></Row>
          </div>

          <h3 className="mb-2 mt-4 text-xs font-semibold text-[var(--muted)]">Détail par taux</h3>
          <table className="data-table">
            <thead>
              <tr><th>Taux</th><th className="num">Base HT</th><th className="num">TVA</th></tr>
            </thead>
            <tbody>
              {inv.vatLines.length === 0 ? (
                <tr><td colSpan={3} className="text-[var(--muted)]">Aucune ligne</td></tr>
              ) : (
                inv.vatLines.map((l) => (
                  <tr key={l.id}>
                    <td>{formatRate(l.rate)}</td>
                    <td className="num"><Money value={l.baseHT} currency={inv.currency} /></td>
                    <td className="num"><Money value={l.vatAmount} currency={inv.currency} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Card>
      </div>

      <Card className="mt-4 p-4">
        <h2 className="mb-2 text-sm font-semibold">Contrôle automatique des montants</h2>
        {report.issues.length === 0 ? (
          <p className="text-sm text-[var(--success)]">
            ✓ HT + TVA = TTC et les lignes sont cohérentes.
          </p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {report.issues.map((it, i) => (
              <li key={i} className="flex gap-2">
                <span>{it.severity === "error" ? "❌" : "⚠️"}</span>
                <span>{it.message}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="mt-4 p-4">
        <h2 className="mb-2 text-sm font-semibold">Document original</h2>
        {inv.originalFileName ? (
          <a
            href={`/api/factures/${inv.id}/fichier`}
            target="_blank"
            className="text-sm font-medium text-[var(--primary)] hover:underline"
          >
            {inv.originalFileName} — ouvrir le PDF
          </a>
        ) : (
          <p className="text-sm text-[var(--muted)]">Aucun PDF associé à cette facture.</p>
        )}
      </Card>

      {inv.revisions.length > 0 && (
        <Card className="mt-4 p-4">
          <h2 className="mb-2 text-sm font-semibold">Historique des modifications</h2>
          <ul className="space-y-1 text-xs text-[var(--muted)]">
            {inv.revisions.map((r) => (
              <li key={r.id}>
                {formatDate(r.changedAt)} — {r.field} : « {r.oldValue ?? "—"} » → « {r.newValue ?? "—"} »
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}

function Row({ label, children, strong }: { label: string; children: ReactNode; strong?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? "border-t border-[var(--border)] pt-1.5 font-semibold" : ""}`}>
      <span className="text-[var(--muted)]">{label}</span>
      <span>{children}</span>
    </div>
  );
}
