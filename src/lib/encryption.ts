// État du chiffrement des données (piloté par l'application de bureau).
// Un simple fichier marqueur dans le dossier de données : le chiffrement/
// déchiffrement réel est fait par Electron au démarrage / à la fermeture.

import { existsSync } from "node:fs";
import path from "node:path";
import { dataDir } from "./paths";

export const ENCRYPTION_MARKER = "chiffrement.actif";

/** L'application tourne-t-elle dans l'app de bureau (Electron) ? */
export function isDesktopApp(): boolean {
  return process.env.DESKTOP_APP === "1";
}

/** Le chiffrement est-il demandé (prend effet au prochain démarrage) ? */
export function isEncryptionRequested(): boolean {
  return existsSync(path.join(dataDir(), ENCRYPTION_MARKER));
}
