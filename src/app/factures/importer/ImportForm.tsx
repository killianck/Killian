"use client";

import { useActionState, useRef, useState } from "react";
import { importInvoice, type ImportState } from "./actions";

export function ImportForm() {
  const [state, formAction, pending] = useActionState<ImportState, FormData>(importInvoice, {});
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  return (
    <form action={formAction} className="space-y-4">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f && inputRef.current) {
            const dt = new DataTransfer();
            dt.items.add(f);
            inputRef.current.files = dt.files;
            setFileName(f.name);
          }
        }}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-xl border-2 border-dashed p-10 text-center transition-colors ${
          dragOver ? "border-[var(--primary)] bg-[#eff4ff]" : "border-[var(--border)] bg-[#fbfcfd]"
        }`}
      >
        <p className="text-sm font-medium">Glissez-déposez un PDF ici</p>
        <p className="mt-1 text-xs text-[var(--muted)]">ou cliquez pour choisir un fichier (20 Mo max)</p>
        {fileName && <p className="mt-3 text-sm text-[var(--primary)]">{fileName}</p>}
        <input
          ref={inputRef}
          type="file"
          name="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
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
        {pending ? "Import en cours…" : "Importer la facture"}
      </button>

      <p className="text-xs text-[var(--muted)]">
        L&apos;analyse automatique (OCR / IA) n&apos;est pas encore activée : après l&apos;import,
        vous serez invité à vérifier / compléter les informations.
      </p>
    </form>
  );
}
