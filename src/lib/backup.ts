// Sauvegarde de la base de données et des documents de factures.
//
// - `runBackup()`       : crée une sauvegarde maintenant (image COHÉRENTE de la
//                         base via `VACUUM INTO`, jamais une copie de fichier vif).
// - `maybeAutoBackup()` : au plus une fois par jour, au chargement de l'app.
// - `lastBackupAt()`    : date de la dernière sauvegarde RÉUSSIE.
// - `lastBackupError()` : message de la dernière tentative en échec (ou null).

import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { backupDir, databaseFile, uploadDir } from "./paths";

const KEEP = 30;
const PREFIX = "sauvegarde-";
const RESULT_FILE = ".dernier-resultat.json";
const STAMP_FILE = ".derniere-auto";

export type BackupResult = { folder: string; fileCount: number };

function timestamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}h${p(d.getMinutes())}m${p(d.getSeconds())}`;
}

function writeResult(ok: boolean, detail: string): void {
  try {
    mkdirSync(backupDir(), { recursive: true });
    writeFileSync(
      path.join(backupDir(), RESULT_FILE),
      JSON.stringify({ ok, detail, at: new Date().toISOString() }),
    );
  } catch {
    /* non bloquant */
  }
}

/** Crée une sauvegarde immédiate (base + documents), avec rotation. */
export function runBackup(): BackupResult {
  const backupsRoot = backupDir();
  mkdirSync(backupsRoot, { recursive: true });

  // On construit dans un dossier temporaire, renommé en `sauvegarde-*` seulement
  // à la fin : jamais de dossier de sauvegarde vide/partiel qui semble valide.
  const finalName = `${PREFIX}${timestamp()}`;
  const finalDir = path.join(backupsRoot, finalName);
  const tmpDir = path.join(backupsRoot, `.tmp-${finalName}`);
  rmSync(tmpDir, { recursive: true, force: true });
  mkdirSync(tmpDir, { recursive: true });

  let fileCount = 0;
  try {
    // Image COHÉRENTE de la base (fonctionne même si l'application écrit en même
    // temps), pas un cpSync du fichier vif.
    const db = databaseFile();
    if (existsSync(db)) {
      const target = path.join(tmpDir, path.basename(db));
      const src = new DatabaseSync(db);
      try {
        src.exec("PRAGMA busy_timeout = 10000");
        src.exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
      } finally {
        src.close();
      }
      fileCount++;
    }

    // Les documents (PDF / photos) ne changent jamais après import : une simple
    // copie récursive suffit.
    const docs = uploadDir();
    if (existsSync(docs)) {
      cpSync(docs, path.join(tmpDir, "factures-pdf"), { recursive: true });
    }

    renameSync(tmpDir, finalDir);
  } catch (e) {
    rmSync(tmpDir, { recursive: true, force: true });
    writeResult(false, (e as Error).message);
    throw e;
  }

  // Rotation : garder les KEEP plus récentes (tri par NOM, déjà chronologique).
  try {
    const existing = readdirSync(backupsRoot)
      .filter((n) => n.startsWith(PREFIX))
      .sort();
    for (const n of existing.slice(0, Math.max(0, existing.length - KEEP))) {
      rmSync(path.join(backupsRoot, n), { recursive: true, force: true });
    }
  } catch {
    /* non bloquant */
  }

  writeResult(true, finalName);
  return { folder: finalDir, fileCount };
}

/** Date de la dernière sauvegarde RÉUSSIE (dossier contenant le fichier .db). */
export function lastBackupAt(): Date | null {
  const root = backupDir();
  if (!existsSync(root)) return null;
  const dbName = path.basename(databaseFile());
  const valid = readdirSync(root)
    .filter((n) => n.startsWith(PREFIX) && existsSync(path.join(root, n, dbName)))
    .sort();
  const last = valid[valid.length - 1];
  if (!last) return null;
  // "sauvegarde-2026-09-03_14h05m30" -> Date
  const m = last.match(/(\d{4})-(\d{2})-(\d{2})_(\d{2})h(\d{2})m(\d{2})/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m.map(Number);
  return new Date(y, mo - 1, d, h, mi, s);
}

/** Message de la dernière tentative de sauvegarde en échec, ou null. */
export function lastBackupError(): string | null {
  try {
    const raw = JSON.parse(readFileSync(path.join(backupDir(), RESULT_FILE), "utf8"));
    return raw.ok ? null : String(raw.detail || "échec inconnu");
  } catch {
    return null;
  }
}

let checkedThisProcess = false;

/** Sauvegarde automatique : au plus une fois par jour. Ne bloque jamais. */
export function maybeAutoBackup(): void {
  if (checkedThisProcess) return;
  checkedThisProcess = true;
  try {
    const stamp = path.join(backupDir(), STAMP_FILE);
    const today = new Date().toISOString().slice(0, 10);
    if (existsSync(stamp) && readFileSync(stamp, "utf8").trim() === today) return;

    runBackup();
    mkdirSync(path.dirname(stamp), { recursive: true });
    writeFileSync(stamp, today);
  } catch (e) {
    console.error("Sauvegarde automatique impossible :", e);
  }
}
