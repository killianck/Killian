import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-4 text-center">
      <h1 className="text-lg font-semibold text-[var(--foreground)]">Page introuvable</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Cette page n&apos;existe pas ou l&apos;élément demandé a été supprimé.
      </p>
      <Link
        href="/"
        className="mt-5 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white"
      >
        Retour au tableau de bord
      </Link>
    </div>
  );
}
