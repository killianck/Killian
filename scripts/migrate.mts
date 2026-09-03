// Applique les migrations en attente sur la base de données.
//   npm run db:deploy
// (même logique que celle utilisée au démarrage de l'application de bureau)

import path from "node:path";
import { fileURLToPath } from "node:url";
import { applyPendingMigrations } from "../src/lib/migrate";
import { databaseFile } from "../src/lib/paths";

// Chemins résolus par rapport à ce script, pas au dossier courant.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const res = applyPendingMigrations(databaseFile(), path.join(root, "prisma", "migrations"));

for (const w of res.warnings) console.warn("⚠️ " + w);
if (res.backup) console.log(`Copie de sécurité : ${res.backup}`);
if (res.alreadyUpToDate) {
  console.log("✅ Base de données déjà à jour.");
} else {
  console.log(`✅ ${res.applied.length} migration(s) appliquée(s) :`);
  for (const m of res.applied) console.log(`   - ${m}`);
}
