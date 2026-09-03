"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { importInvoices, type ImportState } from "./actions";

const ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,.tif,.tiff,.bmp,.heic,.heif";
const ACCEPT_RE = /\.(pdf|jpe?g|png|webp|tiff?|bmp|heic|heif)$/i;
const MAX_MB = 20;

export function ImportForm() {
  const [state, formAction, pending] = useActionState<ImportState, FormData>(importInvoices, {});
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<{ name: string; problem?: string }[]>([]);
  const [dragOver, setDragOver] = useState(false);

  // Empêche de fermer la fenêtre pendant un import (OCR long) et perdre le travail.
  useEffect(() => {
    if (!pending) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [pending]);

  function addFiles(list: FileList | null) {
    if (!list || !inputRef.current) return;
    const dt = new DataTransfer();
    for (const f of Array.from(list)) dt.items.add(f);
    inputRef.current.files = dt.files;
    setFiles(
      Array.from(dt.files).map((f) => ({
        name: f.name,
        problem: !ACCEPT_RE.test(f.name)
          ? "format non pris en charge"
          : f.size > MAX_MB * 1024 * 1024
            ? `trop volumineux (> ${MAX_MB} Mo)`
            : f.size === 0
              ? "fichier vide"
              : undefined,
      })),
    );
  }

  const blocking = files.some((f) => f.problem);
  const count = files.length;

  return (
    <form action={formAction} className="space-y-4">
      <div
        role="button"
        tabIndex={0}
        aria-label="Choisir des fichiers PDF ou des photos"
        onDragOver={(e) => { e.preventDefault(); if (!pending) setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (!pending) addFiles(e.dataTransfer.files);
        }}
        onClick={() => !pending && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !pending) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        className={`rounded-xl border-2 border-dashed p-10 text-center transition-colors ${
          pending ? "cursor-not-allowed opacity-60" : "cursor-pointer"
        } ${dragOver ? "border-[var(--primary)] bg-[#eff4ff]" : "border-[var(--border)] bg-[#fbfcfd]"}`}
      >
        <p className="text-sm font-medium">Glissez-déposez vos factures ici</p>
        <p className="mt-1 text-xs text-[var(--muted)]">
          PDF ou photo (JPG, PNG…), {MAX_MB} Mo max par fichier — cliquez pour parcourir
        </p>
        {count > 0 && (
          <ul className="mt-3 space-y-0.5 text-sm">
            {files.map((f, i) => (
              <li key={i} className={f.problem ? "text-[var(--danger)]" : "text-[var(--primary)]"}>
                {f.name}
                {f.problem ? ` — ${f.problem}` : ""}
              </li>
            ))}
          </ul>
        )}
        <input
          ref={inputRef}
          type="file"
          name="file"
          accept={ACCEPT}
          multiple
          className="sr-only"
          disabled={pending}
          onChange={(e) => addFiles(e.target.files)}
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <label className="text-sm">
          Sens
          <select name="direction" disabled={pending} className="ml-2 rounded-lg border border-[var(--border)] px-2 py-1.5 text-sm">
            <option value="achat">Achat (facture fournisseur)</option>
            <option value="vente">Vente (facture client)</option>
          </select>
        </label>
        <label className="text-sm">
          Type
          <select name="documentType" disabled={pending} className="ml-2 rounded-lg border border-[var(--border)] px-2 py-1.5 text-sm">
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
        disabled={pending || count === 0 || blocking}
        className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending
          ? "Analyse en cours… (la lecture d'un scan peut prendre ~10 s/page, ne fermez pas la fenêtre)"
          : count > 1
            ? `Importer ${count} documents`
            : "Importer le document"}
      </button>

      {state.results && (
        <div className="rounded-lg border border-[var(--border)] p-3">
          <p className="mb-2 text-sm font-semibold">
            Résultat : {state.results.filter((r) => r.status === "ok").length}/{state.results.length} importé(s)
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
