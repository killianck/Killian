import { redirect } from "next/navigation";
import { hasAnyUser } from "@/lib/auth";
import { SetupForm } from "./SetupForm";

export const dynamic = "force-dynamic";

export default async function BienvenuePage() {
  // Un compte existe déjà -> on passe directement à la connexion.
  if (await hasAnyUser()) redirect("/connexion");

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">Facturation &amp; TVA</p>
        <h1 className="mt-1 text-lg font-semibold">Première utilisation</h1>
        <p className="mb-5 mt-1 text-sm text-[var(--muted)]">
          Cet ordinateur n&apos;a encore aucun compte. Créez le vôtre : ce sera le compte
          <strong> administrateur</strong> (vous pourrez en ajouter d&apos;autres ensuite,
          dans Paramètres). Choisissez un mot de passe que vous retiendrez.
        </p>
        <SetupForm />
      </div>
    </main>
  );
}
