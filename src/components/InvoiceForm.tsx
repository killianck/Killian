"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import type { InvoiceFormState } from "@/lib/invoices/form";
import { parseAmount } from "@/lib/format";
import { checkCoherence } from "@/lib/tva/coherence";
import { totalsFromLines, vatOfLine } from "@/lib/tva/lines";
import { CATEGORIES, DIRECTIONS, DOCUMENT_TYPES } from "@/lib/domain/enums";
import { VAT_RATES } from "@/lib/tva/rules";

export type EditableInvoice = {
  documentType: string;
  direction: string;
  category: string | null;
  number: string | null;
  invoiceDate: string; // "AAAA-MM-JJ"
  dueDate: string; // "AAAA-MM-JJ" ou ""
  partyName: string | null;
  partyAddress: string | null;
  siret: string | null;
  vatNumber: string | null;
  currency: string;
  notes: string | null;
  totalHT: number;
  totalVAT: number;
  totalTTC: number;
  deductible: boolean;
  vatLines: { rate: number; baseHT: number; vatAmount: number }[];
};

type Line = { rate: string; baseHT: string; vatAmount: string };

const field = "rounded-lg border border-[var(--border)] bg-white px-2.5 py-1.5 text-sm w-full";
const label = "text-xs text-[var(--muted)] mb-1 block";

export function InvoiceForm({
  invoice,
  action,
  submitLabel,
  cancelHref,
  partyNames = [],
}: {
  invoice: EditableInvoice;
  action: (prev: InvoiceFormState, fd: FormData) => Promise<InvoiceFormState>;
  submitLabel: string;
  cancelHref: string;
  partyNames?: string[];
}) {
  const [state, formAction, pending] = useActionState<InvoiceFormState, FormData>(action, {});

  const hasLines = invoice.vatLines.length > 0;
  const [lines, setLines] = useState<Line[]>(
    invoice.vatLines.map((l) => ({ rate: String(l.rate), baseHT: String(l.baseHT), vatAmount: String(l.vatAmount) })),
  );
  const [direction, setDirection] = useState(invoice.direction);
  // Pas de lignes détaillées mais des totaux connus (cas courant d'un import) :
  // on saisit d'emblée en « totaux manuels », préremplis avec les valeurs de la
  // facture, pour ne jamais les remettre à 0 par accident.
  const hasTotals = invoice.totalHT !== 0 || invoice.totalVAT !== 0 || invoice.totalTTC !== 0;
  const [manualTotals, setManualTotals] = useState(!hasLines && hasTotals);
  const [totals, setTotals] = useState({
    totalHT: String(invoice.totalHT),
    totalVAT: String(invoice.totalVAT),
    totalTTC: String(invoice.totalTTC),
  });

  const numericLines = useMemo(
    () => lines.map((l) => ({ rate: parseAmount(l.rate), baseHT: parseAmount(l.baseHT), vatAmount: parseAmount(l.vatAmount) })),
    [lines],
  );
  const computed = useMemo(() => totalsFromLines(numericLines), [numericLines]);

  const effectiveTotals = useMemo(
    () =>
      manualTotals
        ? {
            totalHT: parseAmount(totals.totalHT),
            totalVAT: parseAmount(totals.totalVAT),
            totalTTC: parseAmount(totals.totalTTC),
          }
        : computed,
    [manualTotals, totals, computed],
  );

  const report = useMemo(
    () => checkCoherence({ ...effectiveTotals, vatLines: numericLines }),
    [effectiveTotals, numericLines],
  );

  const setLine = (i: number, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="vatLinesJson" value={JSON.stringify(numericLines)} />

      {/* ------- Informations générales ------- */}
      <section className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={label}>Type de document</label>
          <select name="documentType" defaultValue={invoice.documentType} className={field}>
            {Object.entries(DOCUMENT_TYPES).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={label}>Sens</label>
          <select
            name="direction"
            value={direction}
            onChange={(e) => setDirection(e.target.value)}
            className={field}
          >
            {Object.entries(DIRECTIONS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={label}>Catégorie</label>
          <select name="category" defaultValue={invoice.category ?? ""} className={field}>
            <option value="">— Aucune —</option>
            {Object.entries(CATEGORIES).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={label}>Numéro</label>
          <input name="number" defaultValue={invoice.number ?? ""} className={field} />
        </div>
        <div>
          <label className={label}>Date de facture</label>
          <input type="date" name="invoiceDate" defaultValue={invoice.invoiceDate} required className={field} />
        </div>
        <div>
          <label className={label}>Date d&apos;échéance</label>
          <input type="date" name="dueDate" defaultValue={invoice.dueDate} className={field} />
          <p className="mt-1 text-[11px] text-[var(--muted)]">Laisser vide si non indiquée sur la facture.</p>
        </div>
        <div>
          <label className={label}>Fournisseur / Client</label>
          <input
            name="partyName"
            defaultValue={invoice.partyName ?? ""}
            list="known-parties"
            autoComplete="off"
            className={field}
          />
          <datalist id="known-parties">
            {partyNames.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
          <p className="mt-1 text-[11px] text-[var(--muted)]">
            Un tiers connu est reconnu automatiquement (ses coordonnées sont réutilisées).
          </p>
        </div>
        <div>
          <label className={label}>Devise</label>
          <input name="currency" defaultValue={invoice.currency} className={field} />
        </div>
        <div className="sm:col-span-2">
          <label className={label}>Adresse</label>
          <input name="partyAddress" defaultValue={invoice.partyAddress ?? ""} className={field} />
        </div>
        <div>
          <label className={label}>SIRET</label>
          <input name="siret" defaultValue={invoice.siret ?? ""} className={field} />
        </div>
        <div>
          <label className={label}>TVA intracommunautaire</label>
          <input name="vatNumber" defaultValue={invoice.vatNumber ?? ""} className={field} />
        </div>
        <div className="sm:col-span-2">
          <label className={label}>Notes</label>
          <textarea name="notes" defaultValue={invoice.notes ?? ""} rows={2} className={field} />
        </div>

        {direction === "achat" && (
          <div className="sm:col-span-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="deductible" value="1" defaultChecked={invoice.deductible} />
              TVA récupérable sur cet achat
            </label>
            <p className="mt-1 text-[11px] text-[var(--muted)]">
              Décochez si la TVA de cette facture n&apos;est pas déductible (dépense exclue, usage privé…).
              Elle sera alors retirée du calcul de la TVA déductible.
            </p>
          </div>
        )}
      </section>

      {/* ------- Lignes de TVA ------- */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Lignes de TVA</h2>
          <button
            type="button"
            onClick={() => setLines((ls) => [...ls, { rate: "20", baseHT: "", vatAmount: "" }])}
            className="text-xs font-medium text-[var(--primary)]"
          >
            + Ajouter une ligne
          </button>
        </div>
        {lines.length === 0 && (
          <p className="rounded-lg bg-[#f9fafb] px-3 py-2 text-xs text-[var(--muted)]">
            Aucun détail par taux. Renseignez les totaux ci-dessous (« Saisir les totaux
            manuellement »), ou ajoutez une ligne si la facture détaille plusieurs taux.
          </p>
        )}
        <div className="space-y-2">
          {lines.map((l, i) => {
            const expected = vatOfLine(parseAmount(l.baseHT), parseAmount(l.rate));
            return (
              <div key={i} className="flex flex-wrap items-end gap-2">
                <div>
                  <label className={label}>Taux %</label>
                  <input
                    list="vat-rates"
                    value={l.rate}
                    onChange={(e) => setLine(i, { rate: e.target.value })}
                    className={`${field} w-24`}
                  />
                </div>
                <div>
                  <label className={label}>Base HT</label>
                  <input
                    inputMode="decimal"
                    value={l.baseHT}
                    onChange={(e) => setLine(i, { baseHT: e.target.value })}
                    className={`${field} w-32`}
                  />
                </div>
                <div>
                  <label className={label}>Montant TVA</label>
                  <input
                    inputMode="decimal"
                    value={l.vatAmount}
                    onChange={(e) => setLine(i, { vatAmount: e.target.value })}
                    className={`${field} w-32`}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setLine(i, { vatAmount: String(expected) })}
                  className="h-8 rounded-lg border border-[var(--border)] px-2 text-xs"
                  title="Calculer la TVA à partir de la base et du taux"
                >
                  ⟳ {expected}
                </button>
                {lines.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}
                    className="h-8 rounded-lg border border-[var(--border)] px-2 text-xs text-[var(--danger)]"
                  >
                    ✕
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <datalist id="vat-rates">
          {VAT_RATES.map((r) => (
            <option key={r.rate} value={r.rate} />
          ))}
        </datalist>
      </section>

      {/* ------- Totaux ------- */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Totaux</h2>
          <label className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
            <input type="checkbox" checked={manualTotals} onChange={(e) => setManualTotals(e.target.checked)} />
            Saisir les totaux manuellement
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {(["totalHT", "totalVAT", "totalTTC"] as const).map((k) => (
            <div key={k}>
              <label className={label}>{k === "totalHT" ? "Total HT" : k === "totalVAT" ? "Total TVA" : "Total TTC"}</label>
              <input
                name={manualTotals ? k : undefined}
                inputMode="decimal"
                value={manualTotals ? totals[k] : String(computed[k])}
                onChange={(e) => setTotals((t) => ({ ...t, [k]: e.target.value }))}
                readOnly={!manualTotals}
                className={`${field} ${!manualTotals ? "bg-[#f9fafb] text-[var(--muted)]" : ""}`}
              />
            </div>
          ))}
        </div>
        {!manualTotals && (
          <p className="mt-1 text-[11px] text-[var(--muted)]">
            Calculés automatiquement à partir des lignes de TVA.
          </p>
        )}
      </section>

      {/* ------- Contrôle en direct ------- */}
      <section
        className={`rounded-lg border p-3 text-sm ${
          report.level === "coherent"
            ? "border-[var(--success-bg)] bg-[var(--success-bg)]"
            : report.level === "incoherent"
              ? "border-[var(--danger-bg)] bg-[var(--danger-bg)]"
              : "border-[var(--warning-bg)] bg-[var(--warning-bg)]"
        }`}
      >
        {report.issues.length === 0 ? (
          <span className="text-[var(--success)]">✓ HT + TVA = TTC, montants cohérents.</span>
        ) : (
          <ul className="space-y-1">
            {report.issues.map((it, i) => (
              <li key={i}>{it.severity === "error" ? "❌" : "⚠️"} {it.message}</li>
            ))}
          </ul>
        )}
      </section>

      {state.error && (
        <p className="rounded-lg border border-[var(--danger-bg)] bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger)]">
          ⚠️ {state.error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "Enregistrement…" : submitLabel}
        </button>
        <Link href={cancelHref} className="text-sm text-[var(--muted)]">
          Annuler
        </Link>
      </div>
    </form>
  );
}
