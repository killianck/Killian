// Applique les migrations en attente sur la base de données.
//   npm run db:deploy
// (même logique que celle utilisée au démarrage de l'application de bureau)

import path from "node:path";
import { applyPendingMigrations } from "../src/lib/migrate";
import { databaseFile } from "../src/lib/paths";

const res = applyPendingMigrations(databaseFile(), path.resolve("prisma/migrations"));
if (res.alreadyUpToDate) {
  console.log("✅ Base de données déjà à jour.");
} else {
  console.log(`✅ ${res.applied.length} migration(s) appliquée(s) :`);
  for (const m of res.applied) console.log(`   - ${m}`);
}
