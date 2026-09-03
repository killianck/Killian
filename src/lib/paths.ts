import path from "node:path";

// =============================================================================
//  EMPLACEMENT DES DONNÉES UTILISATEUR
// =============================================================================
//
//  Les données (base de données + PDF des factures + sauvegardes) sont
//  volontairement SÉPARÉES du code source, dans un dossier "data".
//
//  - En développement           : <projet>/data
//  - Pour l'application installée : dossier de données Windows de l'utilisateur,
//    indiqué par la variable d'environnement APP_DATA_DIR (chemin absolu),
//    p. ex. C:\Users\<nom>\AppData\Roaming\FacturationTVA
//
//  Ainsi, installer une nouvelle version du logiciel ne touche jamais aux
//  données existantes.
// =============================================================================

/** Racine du dossier de données. */
export function dataDir(): string {
  const fromEnv = process.env.APP_DATA_DIR;
  if (fromEnv && path.isAbsolute(fromEnv)) return fromEnv;
  return path.join(process.cwd(), "data");
}

/** Dossier des PDF originaux des factures. */
export function uploadDir(): string {
  const fromEnv = process.env.UPLOAD_DIR;
  if (fromEnv && path.isAbsolute(fromEnv)) return fromEnv;
  return path.join(dataDir(), "factures-pdf");
}

/** Dossier des sauvegardes automatiques de la base. */
export function backupDir(): string {
  return path.join(dataDir(), "sauvegardes");
}

/**
 * Résout le chemin RÉEL d'un fichier de facture stocké.
 * On enregistre désormais un nom de fichier relatif (`<uuid>.pdf`), mais
 * d'anciennes factures ont un chemin absolu : on gère les deux, en gardant
 * toujours le fichier à l'intérieur de `uploadDir()` (anti-traversée).
 */
export function resolveUploadPath(stored: string | null | undefined): string | null {
  if (!stored) return null;
  const dir = path.resolve(uploadDir());
  const candidate = path.isAbsolute(stored)
    ? path.resolve(stored)
    : path.resolve(dir, path.basename(stored));
  if (candidate !== dir && !candidate.startsWith(dir + path.sep)) return null;
  return candidate;
}

/** Fichier SQLite de la base, déduit de DATABASE_URL (sinon valeur par défaut). */
export function databaseFile(): string {
  const url = process.env.DATABASE_URL ?? "";
  if (url.startsWith("file:")) {
    const p = url.slice("file:".length);
    // Chemin relatif dans DATABASE_URL = relatif au dossier prisma/
    return path.isAbsolute(p) ? p : path.resolve(process.cwd(), "prisma", p);
  }
  return path.join(dataDir(), "facturation.db");
}
