import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDuplicatesOf, getInvoice } from "@/lib/queries";
import { getCurrentUser } from "@/lib/auth";
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
import { DeleteInvoiceButton } from "@/components/DeleteInvoiceButton";
import { deleteInvoice, reanalyzeInvoice, setInvoiceStatus } from "./actions";

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;

export default async function InvoiceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SP>;
}) {
  const { id } = await params;
  const analyse = (await searchParams).analyse;
  const inv = await getInvoice(id);
  if (!inv) notFound();

  const duplicates = await getDuplicatesOf(inv);
  const user = await getCurrentUser();

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
    [
      inv.direction === "achat" ? "Fournisseur" : "Client",
      inv.partyId ? (
        <Link href={`/tiers/${inv.partyId}`} className="text-[var(--primary)] hover:underline">
          {inv.partyName ?? "—"}
        </Link>
      ) : (
        inv.partyName ?? "—"
      ),
    ],
    ["Adresse", inv.partyAddress ?? "—"],
    ["SIRET", inv.siret ?? "—"],
    ["TVA intracommunautaire", inv.vatNumber ?? "—"],
    ["Devise", inv.currency],
    ...(inv.direction === "achat"
      ? ([["TVA récupérable", inv.deductible ? "Oui" : "Non — exclue de la TVA déductible"]] as [string, ReactNode][])
      : []),
  ];

  return (
    <>
      <PageHeader
        title={`Facture ${inv.number ?? ""}`.trim()}
        subtitle={inv.partyName ?? undefined}
        action={
          <div className="flex items-center gap-3">
            {inv.originalFilePath && (
              <form action={reanalyzeInvoice.bind(null, inv.id)}>
                <button className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium" title="Relancer l'analyse automatique du PDF (remplace les valeurs actuelles)">
                  Ré-analyser
                </button>
              </form>
            )}
            <Link
              href={`/factures/${inv.id}/modifier`}
              className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium"
            >
              Modifier
            </Link>
            <Link href="/factures" className="text-sm text-[var(--muted)]">
              ← Retour
            </Link>
          </div>
        }
      />

      {analyse === "ok" && (
        <p className="mb-4 rounded-lg border border-[var(--success-bg)] bg-[var(--success-bg)] px-3 py-2 text-xs text-[var(--success)]">
          Analyse relancée. Vérifiez les valeurs ci-dessous (les changements sont dans l&apos;historique).
        </p>
      )}
      {analyse === "vide" && (
        <p className="mb-4 rounded-lg border border-[var(--warning-bg)] bg-[var(--warning-bg)] px-3 py-2 text-xs text-[var(--warning)]">
          L&apos;analyse automatique n&apos;a rien pu extraire de ce PDF (probablement un scan). Saisissez les informations via « Modifier ».
        </p>
      )}
      {analyse === "nofile" && (
        <p className="mb-4 rounded-lg border border-[var(--danger-bg)] bg-[var(--danger-bg)] px-3 py-2 text-xs text-[var(--danger)]">
          Le PDF d&apos;origine est introuvable.
        </p>
      )}

      {duplicates.length > 0 && (
        <div className="mb-4 rounded-lg border border-[var(--warning-bg)] bg-[var(--warning-bg)] px-3 py-2 text-xs text-[var(--warning)]">
          ⚠️ Doublon potentiel avec&nbsp;:
          {duplicates.map((d) => (
            <Link key={d.id} href={`/factures/${d.id}`} className="ml-1.5 font-medium underline">
              {d.number ?? "sans numéro"} ({formatDate(d.invoiceDate)})
            </Link>
          ))}
          . Vérifiez qu&apos;il ne s&apos;agit pas de la même facture importée deux fois.
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <StatusBadge status={inv.status} />
        <CoherenceBadge level={report.level} />
        <div className="ml-auto flex gap-2">
          {inv.status !== "validee" && (
            <form action={setInvoiceStatus.bind(null, inv.id, "validee")}>
              <button className="rounded-lg bg-[var(--success)] px-3 py-1.5 text-xs font-medium text-white">
                ✓ Valider la facture
              </button>
            </form>
          )}
          {inv.status === "validee" && (
            <form action={setInvoiceStatus.bind(null, inv.id, "a_verifier")}>
              <button className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium">
                Repasser en « à vérifier »
              </button>
            </form>
          )}
        </div>
      </div>

      {report.level === "incoherent" && inv.status !== "validee" && (
        <p className="mb-4 rounded-lg border border-[var(--danger-bg)] bg-[var(--danger-bg)] px-3 py-2 text-xs text-[var(--danger)]">
          Les montants semblent incohérents. Vérifiez-les via « Modifier » avant de valider.
        </p>
      )}

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
                {formatDate(r.changedAt)}
                {r.userName ? ` · ${r.userName}` : ""} — {r.field} : « {r.oldValue ?? "—"} » → « {r.newValue ?? "—"} »
              </li>
            ))}
          </ul>
        </Card>
      )}

      {user?.role === "admin" && (
        <Card className="mt-4 p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold">Supprimer</h2>
              <p className="text-xs text-[var(--muted)]">
                Retire la facture de tous les calculs. Le PDF d&apos;origine est déplacé dans « data/corbeille », pas effacé.
              </p>
            </div>
            <DeleteInvoiceButton action={deleteInvoice.bind(null, inv.id)} />
          </div>
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
