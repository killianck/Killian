// Sauvegarde de la base de données et des PDF de factures.
//
// - `runBackup()`       : crée une sauvegarde maintenant.
// - `maybeAutoBackup()` : crée une sauvegarde une fois par jour (appelée au
//                         chargement de l'application).
// - `lastBackupAt()`    : date de la dernière sauvegarde.

import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { backupDir, dataDir, databaseFile } from "./paths";

const KEEP = 30;

export type BackupResult = { folder: string; fileCount: number };

function timestamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}h${p(d.getMinutes())}`;
}

/** Crée une sauvegarde immédiate (base + PDF), avec rotation des anciennes. */
export function runBackup(): BackupResult {
  const root = dataDir();
  const backupsRoot = backupDir();
  const folder = path.join(backupsRoot, `sauvegarde-${timestamp()}`);
  mkdirSync(folder, { recursive: true });

  let fileCount = 0;

  const db = databaseFile();
  for (const suffix of ["", "-wal", "-shm"]) {
    const src = db + suffix;
    if (existsSync(src)) {
      cpSync(src, path.join(folder, path.basename(src)));
      fileCount++;
    }
  }

  const pdfDir = path.join(root, "factures-pdf");
  if (existsSync(pdfDir)) {
    cpSync(pdfDir, path.join(folder, "factures-pdf"), { recursive: true });
  }

  // Rotation : ne garder que les KEEP plus récentes
  const existing = readdirSync(backupsRoot)
    .filter((n) => n.startsWith("sauvegarde-"))
    .map((n) => ({ n, t: statSync(path.join(backupsRoot, n)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  for (const { n } of existing.slice(KEEP)) {
    rmSync(path.join(backupsRoot, n), { recursive: true, force: true });
  }

  return { folder, fileCount };
}

/** Date de la dernière sauvegarde (auto ou manuelle), ou null. */
export function lastBackupAt(): Date | null {
  const backupsRoot = backupDir();
  if (!existsSync(backupsRoot)) return null;
  const times = readdirSync(backupsRoot)
    .filter((n) => n.startsWith("sauvegarde-"))
    .map((n) => statSync(path.join(backupsRoot, n)).mtimeMs);
  if (!times.length) return null;
  return new Date(Math.max(...times));
}

let checkedThisProcess = false;

/**
 * Sauvegarde automatique : au plus une fois par jour.
 * Appelée au chargement de l'application ; ne bloque jamais l'affichage
 * en cas d'erreur.
 */
export function maybeAutoBackup(): void {
  if (checkedThisProcess) return;
  checkedThisProcess = true;
  try {
    const stamp = path.join(backupDir(), ".derniere-auto");
    const today = new Date().toISOString().slice(0, 10);
    if (existsSync(stamp) && readFileSync(stamp, "utf8").trim() === today) return;

    runBackup();
    mkdirSync(path.dirname(stamp), { recursive: true });
    writeFileSync(stamp, today);
  } catch (e) {
    console.error("Sauvegarde automatique impossible :", e);
  }
}
