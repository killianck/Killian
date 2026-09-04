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
import { AutoRefresh } from "@/components/AutoRefresh";
import { deleteInvoice, reanalyzeInvoice, setInvoiceStatus, setStatementFlag } from "./actions";

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
  const sp = await searchParams;
  const analyse = sp.analyse;
  const erreur = sp.erreur;
  const inv = await getInvoice(id);
  if (!inv) notFound();

  const analysing = inv.status === "analyse_en_cours";
  const duplicates = analysing ? [] : await getDuplicatesOf(inv);
  const user = await getCurrentUser();

  const report = checkCoherence({
    totalHT: inv.totalHT,
    totalVAT: inv.totalVAT,
    totalTTC: inv.totalTTC,
    vatLines: inv.vatLines,
  });

  const kind = invoiceKind(inv.documentType as DocumentType, inv.direction as Direction);
  const grossTTC = inv.statementGrossTTC ?? inv.totalTTC;
  const coveredTTC = Math.max(0, (inv.statementGrossTTC ?? inv.totalTTC) - inv.totalTTC);

  const rows: [string, ReactNode][] = [
    ["Type de document", inv.isStatement ? "Relevé de factures" : DOCUMENT_TYPES[inv.documentType as keyof typeof DOCUMENT_TYPES]],
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
      <AutoRefresh active={analysing} />
      <PageHeader
        title={`${inv.isStatement ? "Relevé" : "Facture"} ${inv.number ?? ""}`.trim()}
        subtitle={inv.partyName ?? undefined}
        action={
          <div className="flex items-center gap-3">
            {inv.originalFilePath && !analysing && (
              <form action={reanalyzeInvoice.bind(null, inv.id)}>
                <button className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium" title="Relancer l'analyse automatique du document">
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

      {analysing && (
        <p className="mb-4 flex items-center gap-2 rounded-lg border border-[#dbe7ff] bg-[#eff4ff] px-3 py-2 text-sm text-[var(--primary)]">
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
          Analyse automatique en cours (lecture / OCR du document)… La page se met à jour toute seule.
        </p>
      )}
      {analyse === "lancee" && !analysing && (
        <p className="mb-4 rounded-lg border border-[var(--success-bg)] bg-[var(--success-bg)] px-3 py-2 text-xs text-[var(--success)]">
          Ré-analyse lancée.
        </p>
      )}
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
          Le document d&apos;origine est introuvable.
        </p>
      )}
      {analyse === "erreur" && (
        <p className="mb-4 rounded-lg border border-[var(--danger-bg)] bg-[var(--danger-bg)] px-3 py-2 text-xs text-[var(--danger)]">
          La ré-analyse a échoué. Les valeurs actuelles sont conservées.
        </p>
      )}
      {erreur === "incoherence" && (
        <p className="mb-4 rounded-lg border border-[var(--danger-bg)] bg-[var(--danger-bg)] px-3 py-2 text-xs text-[var(--danger)]">
          Impossible de valider : les montants sont incohérents (HT + TVA ≠ TTC, ou valeur absurde).
          Corrigez-les via « Modifier ».
        </p>
      )}
      {(erreur === "enregistrement" || erreur === "suppression") && (
        <p className="mb-4 rounded-lg border border-[var(--danger-bg)] bg-[var(--danger-bg)] px-3 py-2 text-xs text-[var(--danger)]">
          L&apos;opération a échoué (la base était peut-être occupée). Réessayez.
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

      {inv.statementRefs.length > 0 && (
        <div className="mb-4 rounded-lg border border-[#dbe7ff] bg-[#eff4ff] px-3 py-2 text-xs text-[var(--primary)]">
          Cette facture figure sur&nbsp;
          {inv.statementRefs.map((ref, i) => (
            <span key={ref.id}>
              {i > 0 && ", "}
              <Link href={`/factures/${ref.statement.id}`} className="font-medium underline">
                le relevé {ref.statement.number ?? "sans numéro"}
              </Link>
              {ref.statement.partyName ? ` (${ref.statement.partyName})` : ""}
            </span>
          ))}
          . Elle est comptée une seule fois : le relevé a été réduit d&apos;autant.
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <StatusBadge status={inv.status} />
        {inv.isStatement && (
          <span className="inline-flex items-center rounded-full bg-[#eef2ff] px-2 py-0.5 text-xs font-medium text-[#4338ca]">
            Relevé de factures
          </span>
        )}
        {!analysing && !inv.isStatement && <CoherenceBadge level={report.level} />}
        {!analysing && typeof inv.confidence === "number" && inv.status !== "validee" && (
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
              inv.confidence >= 0.75
                ? "bg-[var(--success-bg)] text-[var(--success)]"
                : inv.confidence >= 0.5
                  ? "bg-[#eff4ff] text-[var(--primary)]"
                  : "bg-[var(--warning-bg)] text-[var(--warning)]"
            }`}
            title="Fiabilité estimée de l'extraction automatique — plus elle est basse, plus il faut relire les montants."
          >
            Extraction : {Math.round(inv.confidence * 100)} %
          </span>
        )}
        <div className="ml-auto flex gap-2">
          {!inv.isStatement && !analysing && inv.status !== "validee" && (
            <form action={setStatementFlag.bind(null, inv.id, true)}>
              <button
                className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium"
                title="Ce document liste plusieurs factures (récapitulatif fournisseur)"
              >
                C&apos;est un relevé
              </button>
            </form>
          )}
          {inv.status !== "validee" && !analysing && (
            <form action={setInvoiceStatus.bind(null, inv.id, "validee")}>
              <button
                disabled={inv.isStatement ? inv.coherence === "incoherent" : report.level === "incoherent"}
                title={report.level === "incoherent" ? "Corrigez les montants incohérents avant de valider" : undefined}
                className="rounded-lg bg-[var(--success)] px-3 py-1.5 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                {inv.isStatement ? "✓ Valider le relevé" : "✓ Valider la facture"}
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

      {report.level === "incoherent" && inv.status !== "validee" && !analysing && !inv.isStatement && (
        <p className="mb-4 rounded-lg border border-[var(--danger-bg)] bg-[var(--danger-bg)] px-3 py-2 text-xs text-[var(--danger)]">
          Les montants semblent incohérents. Vérifiez-les via « Modifier » avant de valider.
        </p>
      )}

      {inv.isStatement && !analysing && (
        <Card className="mb-4 p-4">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Détail du relevé</h2>
              <p className="text-xs text-[var(--muted)]">
                Un relevé regroupe plusieurs factures. Seules les factures encore absentes du
                logiciel sont comptées <em>via</em> ce relevé ; celles déjà déposées sont
                rapprochées et ne comptent qu&apos;une fois.
              </p>
            </div>
            {inv.status !== "validee" && (
              <form action={setStatementFlag.bind(null, inv.id, false)}>
                <button className="whitespace-nowrap rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium">
                  Ce n&apos;est pas un relevé
                </button>
              </form>
            )}
          </div>

          <div className="mb-3 grid grid-cols-3 gap-2 text-sm">
            <div className="rounded-lg bg-[#f9fafb] p-2">
              <div className="text-xs text-[var(--muted)]">Cumul du relevé</div>
              <Money value={grossTTC} currency={inv.currency} />
            </div>
            <div className="rounded-lg bg-[#f9fafb] p-2">
              <div className="text-xs text-[var(--muted)]">Déjà dans le logiciel</div>
              <Money value={coveredTTC} currency={inv.currency} />
            </div>
            <div className="rounded-lg bg-[#eff4ff] p-2">
              <div className="text-xs text-[var(--primary)]">Compté via ce relevé</div>
              <strong><Money value={inv.totalTTC} currency={inv.currency} /></strong>
            </div>
          </div>

          {inv.statementLines.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              Aucune ligne n&apos;a pu être lue. Déposez les factures listées une par une.
            </p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Facture</th>
                  <th>Date</th>
                  <th className="num">Montant TTC</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {inv.statementLines.map((l) => (
                  <tr key={l.id}>
                    <td>
                      {l.matchedInvoice ? (
                        <Link href={`/factures/${l.matchedInvoice.id}`} className="text-[var(--primary)] hover:underline">
                          {l.reference}
                        </Link>
                      ) : (
                        l.reference
                      )}
                      {l.label ? <span className="block text-xs text-[var(--muted)]">{l.label}</span> : null}
                    </td>
                    <td>{l.lineDate ? formatDate(l.lineDate) : "—"}</td>
                    <td className="num">
                      {l.amountTTC != null ? <Money value={l.amountTTC} currency={inv.currency} /> : "—"}
                    </td>
                    <td>
                      {l.matchedInvoice ? (
                        <span className="text-[var(--success)]">✓ rapprochée</span>
                      ) : (
                        <span className="text-[var(--warning)]">à déposer</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
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
          {inv.notes && (() => {
            const items = inv.notes.split(/\n+/).map((s) => s.trim()).filter(Boolean);
            const looksLikeChecklist =
              inv.status !== "validee" &&
              /non détect|à vérifier|à corriger|OCR|scanné|doublon|calculé|incertain|devinée?/i.test(inv.notes);
            if (looksLikeChecklist) {
              return (
                <div className="mt-3 rounded-lg border border-[var(--warning-bg)] bg-[var(--warning-bg)] p-3 text-sm text-[var(--warning)]">
                  <p className="font-semibold">Points à vérifier avant de valider</p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5">
                    {items.map((it, i) => (
                      <li key={i}>{it}</li>
                    ))}
                  </ul>
                </div>
              );
            }
            return (
              <p className="mt-3 whitespace-pre-line rounded-lg bg-[#f9fafb] p-3 text-sm text-[var(--muted)]">
                {inv.notes}
              </p>
            );
          })()}
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

      {!inv.isStatement && (
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
      )}

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
