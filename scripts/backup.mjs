// Sauvegarde de la base de données et des PDF de factures.
//
//   node scripts/backup.mjs         -> crée une sauvegarde
//   npm run backup
//
// Les sauvegardes sont rangées dans  <data>/sauvegardes/sauvegarde-AAAA-MM-JJ_HHhMM/
// Les 30 plus récentes sont conservées, les plus anciennes sont supprimées.

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import path from "node:path";

const KEEP = 30;

function dataDir() {
  const env = process.env.APP_DATA_DIR;
  if (env && path.isAbsolute(env)) return env;
  return path.join(process.cwd(), "data");
}

function dbFile() {
  const url = process.env.DATABASE_URL ?? "";
  if (url.startsWith("file:")) {
    const p = url.slice(5);
    return path.isAbsolute(p) ? p : path.resolve(process.cwd(), "prisma", p);
  }
  return path.join(dataDir(), "facturation.db");
}

function timestamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}h${p(d.getMinutes())}`;
}

const root = dataDir();
const backupsRoot = path.join(root, "sauvegardes");
const target = path.join(backupsRoot, `sauvegarde-${timestamp()}`);
mkdirSync(target, { recursive: true });

// 1) Base de données (+ éventuels fichiers WAL/SHM de SQLite)
const db = dbFile();
let copied = 0;
for (const suffix of ["", "-wal", "-shm"]) {
  const src = db + suffix;
  if (existsSync(src)) {
    cpSync(src, path.join(target, path.basename(src)));
    copied++;
  }
}
if (copied === 0) {
  console.warn(`⚠️  Base de données introuvable (${db}). Sauvegarde des PDF seulement.`);
}

// 2) PDF des factures
const pdfDir = path.join(root, "factures-pdf");
if (existsSync(pdfDir)) {
  cpSync(pdfDir, path.join(target, "factures-pdf"), { recursive: true });
}

// 3) Rotation : ne garder que les KEEP plus récentes
const existing = readdirSync(backupsRoot)
  .filter((n) => n.startsWith("sauvegarde-"))
  .map((n) => ({ n, t: statSync(path.join(backupsRoot, n)).mtimeMs }))
  .sort((a, b) => b.t - a.t);
for (const { n } of existing.slice(KEEP)) {
  rmSync(path.join(backupsRoot, n), { recursive: true, force: true });
}

console.log(`✅ Sauvegarde créée : ${target}`);
console.log(`   (${existing.length > KEEP ? KEEP : existing.length} sauvegarde(s) conservée(s))`);
