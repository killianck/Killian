// Applique les migrations Prisma en attente, sans dépendre du CLI Prisma
// (utilisé au démarrage de l'application de bureau et par `npm run db:deploy`).
//
// S'appuie sur le module natif `node:sqlite` (Node 22.5+ / Electron 30+).
// Les migrations sont additives et écrites par `prisma migrate dev` en
// développement ; cette fonction se contente de les rejouer, en TRANSACTION
// (rollback automatique en cas d'échec) et après une copie de sécurité.

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

export type MigrateResult = {
  applied: string[];
  alreadyUpToDate: boolean;
  backup?: string;
  warnings: string[];
};

const sha256 = (s: string) => createHash("sha256").update(s.replace(/\r\n/g, "\n")).digest("hex");

/**
 * @param dbFile        chemin absolu du fichier SQLite
 * @param migrationsDir dossier contenant les sous-dossiers <timestamp>_<nom>/migration.sql
 */
export function applyPendingMigrations(dbFile: string, migrationsDir: string): MigrateResult {
  mkdirSync(path.dirname(dbFile), { recursive: true });
  const warnings: string[] = [];

  if (!existsSync(migrationsDir)) {
    return { applied: [], alreadyUpToDate: true, warnings };
  }

  const folders = readdirSync(migrationsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  const db = new DatabaseSync(dbFile);
  try {
    db.exec("PRAGMA busy_timeout = 15000");
    db.exec("PRAGMA foreign_keys = ON");
    db.exec(MIGRATIONS_TABLE);

    const rows = db
      .prepare(`SELECT migration_name, checksum FROM "_prisma_migrations" WHERE finished_at IS NOT NULL`)
      .all() as Array<{ migration_name: string; checksum: string }>;
    const done = new Map(rows.map((r) => [String(r.migration_name), String(r.checksum)]));

    // BASELINE : la table de suivi est vide mais le schéma applicatif existe déjà
    // (base restaurée, ancienne installation). On considère les migrations
    // existantes comme appliquées plutôt que de les rejouer (et échouer).
    const appTableExists =
      (db.prepare(`SELECT 1 FROM sqlite_master WHERE type='table' AND name='Invoice'`).get() as unknown) != null;
    if (done.size === 0 && appTableExists && folders.length) {
      for (const name of folders) {
        const sql = readFileSync(path.join(migrationsDir, name, "migration.sql"), "utf8");
        db.prepare(
          `INSERT INTO "_prisma_migrations" (id, checksum, migration_name, started_at, finished_at, applied_steps_count)
           VALUES (?, ?, ?, current_timestamp, current_timestamp, 1)`,
        ).run(randomUUID(), sha256(sql), name);
      }
      warnings.push("Base existante détectée : historique des migrations reconstitué sans rejeu.");
      return { applied: [], alreadyUpToDate: true, warnings };
    }

    // Contrôle de dérive : un fichier de migration livré a-t-il été modifié ?
    for (const [name, stored] of done) {
      const file = path.join(migrationsDir, name, "migration.sql");
      if (existsSync(file) && sha256(readFileSync(file, "utf8")) !== stored) {
        warnings.push(`La migration « ${name} » a changé depuis son application (empreinte différente).`);
      }
    }

    const pending = folders.filter((name) => !done.has(name));
    if (pending.length === 0) {
      return { applied: [], alreadyUpToDate: true, warnings };
    }

    // Copie de sécurité AVANT toute migration (inutile sur une base neuve).
    let backup: string | undefined;
    if (existsSync(dbFile) && done.size > 0) {
      const dir = path.join(path.dirname(dbFile), "sauvegardes");
      mkdirSync(dir, { recursive: true });
      backup = path.join(dir, `avant-migration-${Date.now()}.db`);
      try {
        db.exec(`VACUUM INTO '${backup.replace(/'/g, "''")}'`);
      } catch (e) {
        warnings.push("Copie de sécurité avant migration impossible : " + (e as Error).message);
        backup = undefined;
      }
    }

    const applied: string[] = [];
    for (const name of pending) {
      const sql = readFileSync(path.join(migrationsDir, name, "migration.sql"), "utf8");
      try {
        db.exec("BEGIN IMMEDIATE");
        db.exec(sql);
        db.prepare(
          `INSERT INTO "_prisma_migrations" (id, checksum, migration_name, started_at, finished_at, applied_steps_count)
           VALUES (?, ?, ?, current_timestamp, current_timestamp, 1)`,
        ).run(randomUUID(), sha256(sql), name);
        db.exec("COMMIT");
        applied.push(name);
      } catch (e) {
        try { db.exec("ROLLBACK"); } catch { /* pas de transaction ouverte */ }
        throw new Error(
          `La migration « ${name} » a échoué et a été annulée : ${(e as Error).message}.` +
            (backup ? ` Une copie de la base d'avant migration est disponible : ${backup}` : ""),
        );
      }
    }

    return { applied, alreadyUpToDate: applied.length === 0, backup, warnings };
  } finally {
    db.close();
  }
}
