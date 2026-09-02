// Applique les migrations Prisma en attente, sans dépendre du CLI Prisma
// (utilisé au démarrage de l'application de bureau et par `npm run db:deploy`).
//
// S'appuie sur le module natif `node:sqlite` (Node 22.5+ / Electron 30+).
// Les migrations sont additives et écrites par `prisma migrate dev` en
// développement ; cette fonction se contente de les rejouer.

import { DatabaseSync } from "node:sqlite";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const MIGRATIONS_TABLE = `
CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
  "id"                    TEXT PRIMARY KEY NOT NULL,
  "checksum"              TEXT NOT NULL,
  "finished_at"           DATETIME,
  "migration_name"        TEXT NOT NULL,
  "logs"                  TEXT,
  "rolled_back_at"        DATETIME,
  "started_at"            DATETIME NOT NULL DEFAULT current_timestamp,
  "applied_steps_count"   INTEGER UNSIGNED NOT NULL DEFAULT 0
);`;

export type MigrateResult = { applied: string[]; alreadyUpToDate: boolean };

/**
 * @param dbFile        chemin absolu du fichier SQLite
 * @param migrationsDir dossier contenant les sous-dossiers <timestamp>_<nom>/migration.sql
 */
export function applyPendingMigrations(dbFile: string, migrationsDir: string): MigrateResult {
  mkdirSync(path.dirname(dbFile), { recursive: true });

  if (!existsSync(migrationsDir)) {
    return { applied: [], alreadyUpToDate: true };
  }

  const db = new DatabaseSync(dbFile);
  try {
    db.exec(MIGRATIONS_TABLE);

    const rows = db
      .prepare(`SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL`)
      .all() as Array<{ migration_name: string }>;
    const done = new Set(rows.map((r) => String(r.migration_name)));

    const folders = readdirSync(migrationsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();

    const applied: string[] = [];
    for (const name of folders) {
      if (done.has(name)) continue;

      const sql = readFileSync(path.join(migrationsDir, name, "migration.sql"), "utf8");
      const checksum = createHash("sha256").update(sql).digest("hex");

      try {
        // Pas de transaction explicite : les migrations Prisma gèrent elles-mêmes
        // `PRAGMA foreign_keys` (inopérant à l'intérieur d'une transaction).
        db.exec(sql);
      } catch (e) {
        throw new Error(`La migration « ${name} » a échoué : ${(e as Error).message}`);
      }

      db.prepare(
        `INSERT INTO "_prisma_migrations"
           (id, checksum, migration_name, started_at, finished_at, applied_steps_count)
         VALUES (?, ?, ?, current_timestamp, current_timestamp, 1)`,
      ).run(randomUUID(), checksum, name);

      applied.push(name);
    }

    return { applied, alreadyUpToDate: applied.length === 0 };
  } finally {
    db.close();
  }
}
