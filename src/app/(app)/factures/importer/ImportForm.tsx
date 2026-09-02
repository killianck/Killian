"use client";

import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import { importInvoices, type ImportState } from "./actions";

export function ImportForm() {
  const [state, formAction, pending] = useActionState<ImportState, FormData>(importInvoices, {});
  const inputRef = useRef<HTMLInputElement>(null);
  const [names, setNames] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);

  function addFiles(list: FileList | null) {
    if (!list || !inputRef.current) return;
    const dt = new DataTransfer();
    for (const f of Array.from(list)) dt.items.add(f);
    inputRef.current.files = dt.files;
    setNames(Array.from(dt.files).map((f) => f.name));
  }

  return (
    <form action={formAction} className="space-y-4">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          addFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-xl border-2 border-dashed p-10 text-center transition-colors ${
          dragOver ? "border-[var(--primary)] bg-[#eff4ff]" : "border-[var(--border)] bg-[#fbfcfd]"
        }`}
      >
        <p className="text-sm font-medium">Glissez-déposez un ou plusieurs PDF ici</p>
        <p className="mt-1 text-xs text-[var(--muted)]">ou cliquez pour choisir des fichiers (20 Mo max chacun)</p>
        {names.length > 0 && (
          <ul className="mt-3 space-y-0.5 text-sm text-[var(--primary)]">
            {names.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        )}
        <input
          ref={inputRef}
          type="file"
          name="file"
          accept="application/pdf,.pdf"
          multiple
          className="hidden"
          onChange={(e) => setNames(Array.from(e.target.files ?? []).map((f) => f.name))}
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <label className="text-sm">
          Sens
          <select name="direction" className="ml-2 rounded-lg border border-[var(--border)] px-2 py-1.5 text-sm">
            <option value="achat">Achat (facture fournisseur)</option>
            <option value="vente">Vente (facture client)</option>
          </select>
        </label>
        <label className="text-sm">
          Type
          <select name="documentType" className="ml-2 rounded-lg border border-[var(--border)] px-2 py-1.5 text-sm">
            <option value="facture">Facture</option>
            <option value="avoir">Avoir</option>
          </select>
        </label>
      </div>
      <p className="text-xs text-[var(--muted)]">
        Le sens et le type choisis s&apos;appliquent à tous les fichiers de cet import.
      </p>

      {state.error && (
        <p className="rounded-lg border border-[var(--danger-bg)] bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger)]">
          ⚠️ {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Import en cours…" : names.length > 1 ? `Importer ${names.length} factures` : "Importer la facture"}
      </button>

      {state.results && (
        <div className="rounded-lg border border-[var(--border)] p-3">
          <p className="mb-2 text-sm font-semibold">
            Résultat : {state.results.filter((r) => r.status === "ok").length}/{state.results.length} importée(s)
          </p>
          <ul className="space-y-1 text-sm">
            {state.results.map((r, i) => (
              <li key={i} className="flex items-center gap-2">
                <span>{r.status === "ok" ? "✅" : "❌"}</span>
                <span className="truncate">{r.fileName}</span>
                <span className="text-xs text-[var(--muted)]">— {r.message}</span>
                {r.invoiceId && (
                  <Link href={`/factures/${r.invoiceId}`} className="text-xs font-medium text-[var(--primary)]">
                    ouvrir
                  </Link>
                )}
              </li>
            ))}
          </ul>
          <Link href="/factures" className="mt-2 inline-block text-xs font-medium text-[var(--primary)]">
            Voir toutes les factures →
          </Link>
        </div>
      )}

      <p className="text-xs text-[var(--muted)]">
        Après l&apos;import, vérifiez / complétez les informations de chaque facture (« Modifier »).
      </p>
    </form>
  );
}
