"use client";

// Panneau « Version de l'application » (Paramètres).
// Ne s'affiche que dans l'application installée (fenêtre de bureau), qui expose
// `window.desktop` via le préchargement Electron. Sur le site web classique,
// `window.desktop` n'existe pas et ce panneau reste masqué.

import { useEffect, useState } from "react";
import { Card } from "@/components/ui";
import type { DesktopUpdateStatus as UpdateStatus } from "@/types/desktop";

const MESSAGES: Record<UpdateStatus["state"], string> = {
  inactif: "",
  verification: "Recherche d'une nouvelle version…",
  "a-jour": "Vous avez déjà la dernière version.",
  telechargement: "Téléchargement de la mise à jour en cours…",
  prete: "Mise à jour téléchargée : elle s'installera au prochain redémarrage.",
  erreur: "Vérification impossible pour le moment (connexion ?). Réessayez plus tard.",
  "non-configure": "",
};

export function AppUpdatePanel() {
  const [version, setVersion] = useState<string | null>(null);
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const bridge = window.desktop;
    if (!bridge) return;
    bridge.version().then(setVersion).catch(() => {});
    bridge.updateStatus().then(setStatus).catch(() => {});
    const unsubscribe = bridge.onUpdateStatus(setStatus);
    return unsubscribe;
  }, []);

  // Pas dans l'application installée → rien à afficher.
  if (!version) return null;

  async function check() {
    if (!window.desktop) return;
    setChecking(true);
    try {
      setStatus(await window.desktop.checkForUpdates());
    } catch {
      setStatus({ state: "erreur" });
    } finally {
      setChecking(false);
    }
  }

  const line = status ? MESSAGES[status.state] : "";
  const percent =
    status?.state === "telechargement" && typeof status.percent === "number"
      ? ` (${status.percent} %)`
      : "";

  return (
    <Card className="p-4">
      <h2 className="mb-2 text-sm font-semibold">Version de l&apos;application</h2>
      <p className="text-sm text-[var(--muted)]">
        Version installée :{" "}
        <span className="font-medium text-[var(--foreground)]">{version}</span>
      </p>

      <button
        onClick={check}
        disabled={checking || status?.state === "verification"}
        className="mt-3 rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium disabled:opacity-50"
      >
        {checking ? "Vérification…" : "Vérifier les mises à jour"}
      </button>

      {line ? (
        <p className="mt-2 text-xs text-[var(--foreground)]">
          {line}
          {percent}
        </p>
      ) : null}

      <p className="mt-3 text-xs leading-relaxed text-[var(--muted)]">
        Les mises à jour se téléchargent toutes seules en arrière-plan. Quand une
        nouvelle version est prête, une fenêtre vous propose «&nbsp;Redémarrer
        maintenant&nbsp;». Si vous choisissez «&nbsp;Plus tard&nbsp;», elle
        s&apos;installe à la prochaine fermeture de l&apos;application. Vos données
        ne sont jamais touchées.
      </p>
    </Card>
  );
}
