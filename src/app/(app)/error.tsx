"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Erreur d'affichage :", error);
  }, [error]);

  const isForbidden = /administrateur|réservée? à/i.test(error.message);

  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <h1 className="text-lg font-semibold text-[var(--foreground)]">
        {isForbidden ? "Accès refusé" : "Une erreur s'est produite"}
      </h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        {isForbidden
          ? "Cette action est réservée à un administrateur."
          : "L'affichage de cette page a échoué. Vos données ne sont pas touchées — réessayez, ou revenez au tableau de bord."}
      </p>
      <div className="mt-5 flex items-center justify-center gap-3">
        {!isForbidden && (
          <button
            onClick={reset}
            className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white"
          >
            Réessayer
          </button>
        )}
        <Link href="/" className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium">
          Retour au tableau de bord
        </Link>
      </div>
    </div>
  );
}
