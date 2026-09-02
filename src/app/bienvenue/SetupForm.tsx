"use client";

import { useActionState } from "react";
import { setupFirstUser, type SetupState } from "./actions";

const field = "w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm";

export function SetupForm() {
  const [state, action, pending] = useActionState<SetupState, FormData>(setupFirstUser, {});

  return (
    <form action={action} className="space-y-3">
      <div>
        <label className="mb-1 block text-xs text-[var(--muted)]">Nom d&apos;utilisateur</label>
        <input name="name" autoFocus autoComplete="username" className={field} />
      </div>
      <div>
        <label className="mb-1 block text-xs text-[var(--muted)]">Mot de passe (8 caractères min.)</label>
        <input name="password" type="password" autoComplete="new-password" className={field} />
      </div>
      <div>
        <label className="mb-1 block text-xs text-[var(--muted)]">Confirmer le mot de passe</label>
        <input name="confirm" type="password" autoComplete="new-password" className={field} />
      </div>
      {state.error && (
        <p className="rounded-lg border border-[var(--danger-bg)] bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger)]">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Création…" : "Créer le compte et démarrer"}
      </button>
    </form>
  );
}
