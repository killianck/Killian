import { redirect } from "next/navigation";
import { hasAnyUser } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;

export default async function ConnexionPage({ searchParams }: { searchParams: Promise<SP> }) {
  if (!(await hasAnyUser())) redirect("/bienvenue");
  const suiteRaw = (await searchParams).suite;
  const suite = (Array.isArray(suiteRaw) ? suiteRaw[0] : suiteRaw) || "/";

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <h1 className="text-lg font-semibold">Facturation &amp; TVA</h1>
        <p className="mb-5 mt-1 text-sm text-[var(--muted)]">Connectez-vous pour continuer.</p>
        <LoginForm suite={suite} />
      </div>
    </main>
  );
}
