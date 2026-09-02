import { redirect } from "next/navigation";
import { hasAnyUser } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;

export default async function ConnexionPage({ searchParams }: { searchParams: Promise<SP> }) {
  // Aucun compte sur cet ordinateur -> on va d'abord créer le premier.
  if (!(await hasAnyUser())) redirect("/bienvenue");

  const suiteRaw = (await searchParams).suite;
  const suite = (Array.isArray(suiteRaw) ? suiteRaw[0] : suiteRaw) || "/";

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">Facturation &amp; TVA</p>
        <h1 className="mt-1 text-lg font-semibold">Se connecter</h1>
        <p className="mb-5 mt-1 text-sm text-[var(--muted)]">
          Entrez le nom d&apos;utilisateur et le mot de passe de votre compte.
        </p>
        <LoginForm suite={suite} />
        <p className="mt-4 text-xs text-[var(--muted)]">
          Mot de passe oublié ? Un administrateur peut le réinitialiser dans
          Paramètres → Utilisateurs. Si vous êtes le seul administrateur, voir le
          fichier <code>DEPLOIEMENT.md</code> (commande <code>npm run auth:reset</code>).
        </p>
      </div>
    </main>
  );
}
