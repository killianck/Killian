import { redirect } from "next/navigation";
import { hasAnyUser } from "@/lib/auth";
import { SetupForm } from "./SetupForm";

export const dynamic = "force-dynamic";

export default async function BienvenuePage() {
  if (await hasAnyUser()) redirect("/connexion");

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <h1 className="text-lg font-semibold">Bienvenue</h1>
        <p className="mb-5 mt-1 text-sm text-[var(--muted)]">
          Créez le premier compte (administrateur). Vous pourrez en ajouter d&apos;autres ensuite
          dans Paramètres.
        </p>
        <SetupForm />
      </div>
    </main>
  );
}
