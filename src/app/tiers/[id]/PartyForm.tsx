"use client";

import { useActionState } from "react";
import Link from "next/link";
import { updateParty, type PartyFormState } from "./actions";
import { PARTY_KINDS } from "@/lib/invoices/party";

export type EditableParty = {
  id: string;
  name: string;
  kind: string;
  address: string | null;
  siret: string | null;
  vatNumber: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
};

const field = "rounded-lg border border-[var(--border)] bg-white px-2.5 py-1.5 text-sm w-full";
const label = "text-xs text-[var(--muted)] mb-1 block";

export function PartyForm({ party }: { party: EditableParty }) {
  const [state, formAction, pending] = useActionState<PartyFormState, FormData>(
    updateParty.bind(null, party.id),
    {},
  );

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-2">
      <div>
        <label className={label}>Nom</label>
        <input name="name" defaultValue={party.name} required className={field} />
      </div>
      <div>
        <label className={label}>Type</label>
        <select name="kind" defaultValue={party.kind} className={field}>
          {Object.entries(PARTY_KINDS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-2">
        <label className={label}>Adresse</label>
        <input name="address" defaultValue={party.address ?? ""} className={field} />
      </div>
      <div>
        <label className={label}>SIRET</label>
        <input name="siret" defaultValue={party.siret ?? ""} className={field} />
      </div>
      <div>
        <label className={label}>TVA intracommunautaire</label>
        <input name="vatNumber" defaultValue={party.vatNumber ?? ""} className={field} />
      </div>
      <div>
        <label className={label}>E-mail</label>
        <input name="email" type="email" defaultValue={party.email ?? ""} className={field} />
      </div>
      <div>
        <label className={label}>Téléphone</label>
        <input name="phone" defaultValue={party.phone ?? ""} className={field} />
      </div>
      <div className="sm:col-span-2">
        <label className={label}>Notes</label>
        <textarea name="notes" defaultValue={party.notes ?? ""} rows={2} className={field} />
      </div>

      {state.error && (
        <p className="sm:col-span-2 rounded-lg border border-[var(--danger-bg)] bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger)]">
          ⚠️ {state.error}
        </p>
      )}

      <div className="sm:col-span-2 flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "Enregistrement…" : "Enregistrer"}
        </button>
        <Link href="/tiers" className="text-sm text-[var(--muted)]">Retour</Link>
      </div>
    </form>
  );
}
