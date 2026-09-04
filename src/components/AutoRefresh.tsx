"use client";

// Rafraîchit la page (données serveur) tant qu'il reste des analyses en cours.
// S'arrête tout seul quand `active` repasse à false ou après `maxMs`.

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function AutoRefresh({
  active,
  intervalMs = 3500,
  maxMs = 10 * 60_000,
}: {
  active: boolean;
  intervalMs?: number;
  maxMs?: number;
}) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const started = Date.now();
    const t = setInterval(() => {
      if (Date.now() - started > maxMs) {
        clearInterval(t);
        return;
      }
      router.refresh();
    }, intervalMs);
    return () => clearInterval(t);
  }, [active, intervalMs, maxMs, router]);
  return null;
}
