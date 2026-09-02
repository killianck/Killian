"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

const field = "w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm";

export function LoginForm({ suite }: { suite: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="suite" value={suite} />
      <div>
        <label className="mb-1 block text-xs text-[var(--muted)]">Nom d&apos;utilisateur</label>
        <input name="name" autoFocus autoComplete="username" className={field} />
      </div>
      <div>
        <label className="mb-1 block text-xs text-[var(--muted)]">Mot de passe</label>
        <input name="password" type="password" autoComplete="current-password" className={field} />
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
        {pending ? "Connexion…" : "Se connecter"}
      </button>
    </form>
  );
}
