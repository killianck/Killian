"use client";

import { useActionState } from "react";
import { changePassword, createUser, resetUserPassword, type UserActionState } from "./actions";

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

/** Réinitialisation, par un administrateur, du mot de passe d'un autre compte. */
export function ResetPasswordForm({ users }: { users: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState<UserActionState, FormData>(resetUserPassword, {});
  if (users.length === 0) {
    return (
      <p className="text-sm text-[var(--muted)]">
        Aucun autre compte à réinitialiser.
      </p>
    );
  }
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <div>
        <label className="mb-1 block text-xs text-[var(--muted)]">Compte</label>
        <select name="id" className={field} defaultValue={users[0].id}>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs text-[var(--muted)]">Nouveau mot de passe</label>
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
        Réinitialiser
      </button>
      <p className="w-full text-xs text-[var(--muted)]">
        À utiliser quand quelqu&apos;un a oublié son mot de passe. Communiquez-lui le
        nouveau mot de passe, qu&apos;il pourra ensuite changer lui-même.
      </p>
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
