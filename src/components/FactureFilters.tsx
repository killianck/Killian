"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { MONTH_NAMES_FR } from "@/lib/format";
import { CATEGORIES, DIRECTIONS, DOCUMENT_TYPES } from "@/lib/domain/enums";
import { VAT_RATES } from "@/lib/tva/rules";

export type FilterValues = {
  q: string;
  year: string;
  month: string;
  direction: string;
  type: string;
  category: string;
  rate: string;
  sort: string;
  onlyDuplicates: string;
};

const cls = "rounded-lg border border-[var(--border)] bg-white px-2.5 py-1.5 text-sm";

export function FactureFilters({ values, years }: { values: FilterValues; years: number[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  // les <select> relancent le filtre immédiatement ; la recherche texte au "Entrée" ou au bouton
  const submit = () => formRef.current?.requestSubmit();

  return (
    <form ref={formRef} method="get" className="flex flex-wrap items-end gap-2">
      <input
        type="text"
        name="q"
        defaultValue={values.q}
        placeholder="Rechercher (fournisseur, n°, note)"
        className={`${cls} min-w-56 flex-1`}
      />
      <select name="year" defaultValue={values.year} onChange={submit} className={cls}>
        <option value="">Toutes années</option>
        {years.map((y) => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>
      <select name="month" defaultValue={values.month} onChange={submit} className={cls}>
        <option value="">Tous mois</option>
        {MONTH_NAMES_FR.map((n, i) => (
          <option key={i} value={i + 1}>{n}</option>
        ))}
      </select>
      <select name="direction" defaultValue={values.direction} onChange={submit} className={cls}>
        <option value="">Achat / Vente</option>
        {Object.entries(DIRECTIONS).map(([k, v]) => (
          <option key={k} value={k}>{v}</option>
        ))}
      </select>
      <select name="type" defaultValue={values.type} onChange={submit} className={cls}>
        <option value="">Tous types</option>
        {Object.entries(DOCUMENT_TYPES).map(([k, v]) => (
          <option key={k} value={k}>{v}</option>
        ))}
      </select>
      <select name="category" defaultValue={values.category} onChange={submit} className={cls}>
        <option value="">Toutes catégories</option>
        {Object.entries(CATEGORIES).map(([k, v]) => (
          <option key={k} value={k}>{v}</option>
        ))}
      </select>
      <select name="rate" defaultValue={values.rate} onChange={submit} className={cls}>
        <option value="">Tous taux TVA</option>
        {VAT_RATES.map((r) => (
          <option key={r.rate} value={r.rate}>{r.label}</option>
        ))}
      </select>
      <select name="sort" defaultValue={values.sort} onChange={submit} className={cls}>
        <option value="date_desc">Date ↓</option>
        <option value="date_asc">Date ↑</option>
        <option value="ttc_desc">Montant ↓</option>
        <option value="ttc_asc">Montant ↑</option>
      </select>

      <label className="flex items-center gap-1.5 text-sm text-[var(--muted)]">
        <input
          type="checkbox"
          name="doublons"
          value="1"
          defaultChecked={values.onlyDuplicates === "1"}
          onChange={submit}
        />
        Doublons uniquement
      </label>

      <button type="submit" className="rounded-lg bg-[var(--foreground)] px-3 py-1.5 text-sm text-white">
        Filtrer
      </button>
      <button
        type="button"
        onClick={() => router.push("/factures")}
        className="px-2 py-1.5 text-sm text-[var(--muted)]"
      >
        Réinitialiser
      </button>
    </form>
  );
}
