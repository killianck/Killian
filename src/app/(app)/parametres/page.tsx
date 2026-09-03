import Link from "next/link";
import { PageHeader, Card, Badge } from "@/components/ui";
import { VAT_RATES, TVA_DISCLAIMER } from "@/lib/tva/rules";
import { CATEGORIES, STATUSES } from "@/lib/domain/enums";
import { lastBackupAt, lastBackupError } from "@/lib/backup";
import { formatDate } from "@/lib/format";
import { getCurrentUser } from "@/lib/auth";
import { isDesktopApp, isEncryptionRequested } from "@/lib/encryption";
import { AppUpdatePanel } from "@/components/AppUpdatePanel";
import { backupNow, setEncryption } from "./actions";

export const dynamic = "force-dynamic";

export default async function ParametresPage() {
  const user = await getCurrentUser();
  const parser = process.env.INVOICE_PARSER ?? "heuristic";
  const parserLabel: Record<string, string> = {
    heuristic: "Lecture du texte du PDF + règles (par défaut)",
    stub: "Aucune analyse (saisie 100 % manuelle)",
  };

  const lastBackup = lastBackupAt();
  const backupError = lastBackupError();
  const isAdmin = user?.role === "admin";
  const encryptionOn = isEncryptionRequested();
  const desktop = isDesktopApp();

  return (
    <>
      <PageHeader title="Paramètres" subtitle="Configuration de l'application." />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className="mb-2 text-sm font-semibold">Utilisateurs</h2>
          <p className="text-sm text-[var(--muted)]">
            Connecté en tant que <span className="font-medium text-[var(--foreground)]">{user?.name}</span>
            {" · "}
            {user?.role === "admin" ? "Administrateur" : "Utilisateur"}
          </p>
          <Link
            href="/parametres/utilisateurs"
            className="mt-3 inline-block rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium"
          >
            Gérer les utilisateurs et mon mot de passe
          </Link>
        </Card>

        <Card className="p-4">
          <h2 className="mb-2 text-sm font-semibold">Chiffrement des données</h2>
          <p className="text-sm text-[var(--muted)]">
            État :{" "}
            <span className="font-medium text-[var(--foreground)]">
              {encryptionOn ? "activé" : "désactivé"}
            </span>
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Une fois activé, la base, les PDF et les sauvegardes sont chiffrés (AES-256) au repos
            avec une clé liée à votre compte Windows. Un dossier de données copié ailleurs devient
            illisible. Pense-bête : activez aussi BitLocker pour une protection complète.
          </p>
          {!desktop ? (
            <p className="mt-3 text-xs text-[var(--warning)]">
              Disponible uniquement dans l&apos;application installée (fenêtre de bureau).
            </p>
          ) : isAdmin ? (
            <form action={setEncryption.bind(null, !encryptionOn)} className="mt-3">
              <button className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium">
                {encryptionOn ? "Désactiver le chiffrement" : "Activer le chiffrement"}
              </button>
              <span className="ml-2 text-xs text-[var(--muted)]">
                (prend effet au prochain démarrage de l&apos;application)
              </span>
            </form>
          ) : (
            <p className="mt-3 text-xs text-[var(--muted)]">Réservé à un administrateur.</p>
          )}
        </Card>

        <Card className="p-4">
          <h2 className="mb-2 text-sm font-semibold">Sauvegarde des données</h2>
          <p className="text-sm text-[var(--muted)]">
            Dernière sauvegarde :{" "}
            <span className="font-medium text-[var(--foreground)]">
              {lastBackup
                ? `${formatDate(lastBackup)} à ${lastBackup.getHours()}h${String(lastBackup.getMinutes()).padStart(2, "0")}`
                : "aucune"}
            </span>
          </p>
          {backupError && (
            <p className="mt-2 rounded-lg border border-[var(--danger-bg)] bg-[var(--danger-bg)] px-2.5 py-1.5 text-xs text-[var(--danger)]">
              ⚠️ La dernière sauvegarde a échoué : {backupError}
            </p>
          )}
          <p className="mt-1 text-xs text-[var(--muted)]">
            Une sauvegarde automatique est faite une fois par jour au lancement (image cohérente de
            la base + copie des documents). Les 30 dernières sont conservées dans{" "}
            <code>data/sauvegardes/</code>.
          </p>
          <form action={backupNow} className="mt-3">
            <button className="rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-medium text-white">
              Sauvegarder maintenant
            </button>
          </form>
        </Card>

        <Card className="p-4">
          <h2 className="mb-2 text-sm font-semibold">Analyse des factures</h2>
          <p className="text-sm text-[var(--muted)]">
            Moteur actuel : <Badge tone="info">{parser}</Badge>
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">{parserLabel[parser] ?? parser}</p>
          <p className="mt-2 text-xs text-[var(--muted)]">
            Se règle via la variable <code>INVOICE_PARSER</code> du fichier <code>.env</code>.
            La clé API éventuelle (<code>INVOICE_PARSER_API_KEY</code>) ne doit jamais être mise
            dans le code source.
          </p>
        </Card>

        <Card className="p-4">
          <h2 className="mb-2 text-sm font-semibold">Taux de TVA gérés</h2>
          <ul className="text-sm">
            {VAT_RATES.map((r) => (
              <li key={r.rate} className="flex justify-between border-b border-[var(--border)] py-1">
                <span>{r.label}</span>
                <span className="text-[var(--muted)]">{r.note}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-[var(--muted)]">
            Modifiable dans <code>src/lib/tva/rules.ts</code> (zone des règles fiscales).
          </p>
        </Card>

        <Card className="p-4">
          <h2 className="mb-2 text-sm font-semibold">Catégories</h2>
          <div className="flex flex-wrap gap-1.5">
            {Object.values(CATEGORIES).map((c) => (
              <Badge key={c}>{c}</Badge>
            ))}
          </div>
          <p className="mt-2 text-xs text-[var(--muted)]">
            Extensible dans <code>src/lib/domain/enums.ts</code>.
          </p>
        </Card>

        <Card className="p-4">
          <h2 className="mb-2 text-sm font-semibold">Statuts des factures</h2>
          <div className="flex flex-wrap gap-1.5">
            {Object.values(STATUSES).map((s) => (
              <Badge key={s}>{s}</Badge>
            ))}
          </div>
        </Card>

        <AppUpdatePanel />
      </div>

      <Card className="mt-4 p-4">
        <h2 className="mb-2 text-sm font-semibold">Avertissement</h2>
        <p className="text-sm text-[var(--muted)]">{TVA_DISCLAIMER}</p>
        <p className="mt-2 text-xs text-[var(--muted)]">
          Connexion par compte, rôles (administrateur / utilisateur), journal des modifications
          et chiffrement des données au repos sont disponibles.
        </p>
      </Card>
    </>
  );
}
