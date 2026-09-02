// Après `next build`, complète le dossier .next/standalone pour qu'il soit
// vraiment autonome (Next n'y copie pas tout automatiquement), et génère
// electron/migrate.cjs à partir de src/lib/migrate.ts.

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const standalone = path.join(root, ".next", "standalone");

if (!existsSync(standalone)) {
  console.error("❌ .next/standalone introuvable. Lancez `next build` d'abord.");
  process.exit(1);
}

// SÉCURITÉ : retire toute donnée utilisateur que le "tracing" aurait pu embarquer,
// et remplace le .env par une version sans secret ni chemin de base local.
console.log("Nettoyage du build autonome…");
for (const junk of ["data", ".env.local", ".env.development", ".env.production"]) {
  rmSync(path.join(standalone, junk), { recursive: true, force: true });
}
writeFileSync(
  path.join(standalone, ".env"),
  "# Fichier généré. DATABASE_URL et APP_DATA_DIR sont fournis par l'application.\nINVOICE_PARSER=heuristic\n",
);

function copy(from, to) {
  const src = path.join(root, from);
  if (!existsSync(src)) return;
  const dest = path.join(standalone, to);
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(path.dirname(dest), { recursive: true });
  cpSync(src, dest, { recursive: true });
  console.log(`  copié : ${from} -> standalone/${to}`);
}

console.log("Préparation du serveur autonome…");
copy(".next/static", ".next/static");
copy("public", "public");
// Client Prisma + moteur (au cas où le "tracing" de Next les aurait ratés)
copy("node_modules/.prisma", "node_modules/.prisma");
copy("node_modules/@prisma/client", "node_modules/@prisma/client");
// Migrations, lues au démarrage de l'app
copy("prisma/migrations", "prisma/migrations");

console.log("Génération de electron/migrate.cjs…");
execFileSync(
  process.execPath,
  [
    path.join(root, "node_modules", "esbuild", "bin", "esbuild"),
    "src/lib/migrate.ts",
    "--bundle",
    "--platform=node",
    "--format=cjs",
    "--external:node:*",
    "--outfile=electron/migrate.cjs",
  ],
  { stdio: "inherit", cwd: root },
);

console.log("✅ Prêt pour l'empaquetage (electron-builder).");
