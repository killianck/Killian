import path from "node:path";

// Dossier de stockage des PDF originaux.
// Par défaut : <projet>/uploads. Peut être remplacé par un chemin ABSOLU
// via la variable d'environnement UPLOAD_DIR (utile pour un déploiement).
export function uploadDir(): string {
  const fromEnv = process.env.UPLOAD_DIR;
  if (fromEnv && path.isAbsolute(fromEnv)) return fromEnv;
  return path.join(process.cwd(), "uploads");
}
