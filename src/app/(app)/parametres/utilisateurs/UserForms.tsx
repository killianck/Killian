"use client";

import { useActionState } from "react";
import { changePassword, createUser, type UserActionState } from "./actions";

const field = "rounded-lg border border-[var(--border)] bg-white px-2.5 py-1.5 text-sm";

function Msg({ state }: { state: UserActionState }) {
  if (state.error)
    return <p className="text-sm text-[var(--danger)]">⚠️ {state.error}</p>;
  if (state.ok) return <p className="text-sm text-[var(--success)]">✓ {state.ok}</p>;
  return null;
}

export function CreateUserForm() {
  const [state, action, pending] = useActionState<UserActionState, FormData>(createUser, {});
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <div>
        <label className="mb-1 block text-xs text-[var(--muted)]">Nom</label>
        <input name="name" className={field} />
      </div>
      <div>
        <label className="mb-1 block text-xs text-[var(--muted)]">Mot de passe</label>
        <input name="password" type="password" autoComplete="new-password" className={field} />
      </div>
      <div>
        <label className="mb-1 block text-xs text-[var(--muted)]">Rôle</label>
        <select name="role" className={field} defaultValue="standard">
          <option value="standard">Utilisateur</option>
          <option value="admin">Administrateur</option>
        </select>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-[var(--primary)] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
      >
        Ajouter
      </button>
      <div className="w-full"><Msg state={state} /></div>
    </form>
  );
}

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState<UserActionState, FormData>(changePassword, {});
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <div>
        <label className="mb-1 block text-xs text-[var(--muted)]">Mot de passe actuel</label>
        <input name="current" type="password" autoComplete="current-password" className={field} />
      </div>
      <div>
        <label className="mb-1 block text-xs text-[var(--muted)]">Nouveau</label>
        <input name="next" type="password" autoComplete="new-password" className={field} />
      </div>
      <div>
        <label className="mb-1 block text-xs text-[var(--muted)]">Confirmer</label>
        <input name="confirm" type="password" autoComplete="new-password" className={field} />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-[var(--foreground)] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
      >
        Modifier
      </button>
      <div className="w-full"><Msg state={state} /></div>
    </form>
  );
}
