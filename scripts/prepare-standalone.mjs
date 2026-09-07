// Après `next build`, complète le dossier .next/standalone pour qu'il soit
// vraiment autonome (Next n'y copie pas tout automatiquement), et génère
// electron/migrate.cjs à partir de src/lib/migrate.ts.

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
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

// OCR des PDF scannés : moteurs (WASM + worker) et données de langue française.
// Copiés en entier pour être sûrs que les fichiers .wasm et le script "worker"
// soient présents dans l'application empaquetée (le "tracing" de Next peut les rater).
//
// ⚠️ AVEC LEURS DÉPENDANCES : le script "worker" de tesseract.js fait des
// `require()` au moment de l'exécution (bmp-js, zlibjs…) que l'analyse statique
// de Next ne voit pas. Sans elles, l'OCR plante en boucle dans l'application
// installée — et UNIQUEMENT là, jamais en développement (où node_modules est
// complet). C'est le bug qui a fait échouer silencieusement tous les scans
// jusqu'en v0.2.7.
copy("src/lib/parsing/tessdata", "tessdata");

const requireFromRoot = createRequire(path.join(root, "package.json"));

/** Chemin du dossier d'un paquet installé, ou null. */
function packageDir(name, fromDir) {
  const bases = [fromDir, root].filter(Boolean);
  for (const base of bases) {
    const dir = path.join(base, "node_modules", name);
    if (existsSync(path.join(dir, "package.json"))) return dir;
  }
  try {
    // Repli : résolution Node classique (gère les cas non "hoistés").
    return path.dirname(requireFromRoot.resolve(`${name}/package.json`));
  } catch {
    return null;
  }
}

/** Copie un paquet ET, récursivement, toutes ses dépendances de production. */
function copyPackageWithDeps(name, seen = new Set()) {
  if (seen.has(name)) return;
  seen.add(name);

  const dir = packageDir(name);
  if (!dir) {
    missing.push(name);
    return;
  }
  const rel = path.relative(root, dir).split(path.sep).join("/");
  copy(rel, `node_modules/${name}`);

  let pkg;
  try {
    pkg = JSON.parse(readFileSync(path.join(dir, "package.json"), "utf8"));
  } catch {
    return;
  }
  for (const dep of Object.keys(pkg.dependencies ?? {})) {
    copyPackageWithDeps(dep, seen);
  }
  return seen;
}

const missing = [];
const copied = new Set();
for (const pkg of ["mupdf", "tesseract.js", "tesseract.js-core"]) {
  copyPackageWithDeps(pkg, copied);
}
console.log(`  ${copied.size} paquet(s) OCR copié(s) avec leurs dépendances`);

// GARDE-FOU : le build échoue si une dépendance d'exécution de l'OCR manque.
// (Un OCR cassé ne doit JAMAIS partir en production sans qu'on le sache.)
if (missing.length) {
  console.error(
    `❌ Dépendances OCR introuvables : ${missing.join(", ")}.\n` +
      `   L'OCR planterait dans l'application installée. Lancez « npm ci » puis réessayez.`,
  );
  process.exit(1);
}
for (const dep of Object.keys(
  JSON.parse(readFileSync(path.join(packageDir("tesseract.js"), "package.json"), "utf8")).dependencies ?? {},
)) {
  if (!existsSync(path.join(standalone, "node_modules", dep))) {
    console.error(`❌ « ${dep} » (requis par tesseract.js à l'exécution) absent du build autonome.`);
    process.exit(1);
  }
}

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
