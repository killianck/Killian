// Hook electron-builder : copie le serveur Next autonome dans les ressources
// de l'application packagée (copie complète et fiable, y compris .next et
// node_modules).

const { cpSync, rmSync, existsSync } = require("node:fs");
const path = require("node:path");

exports.default = async function afterPack(context) {
  const source = path.join(context.packager.projectDir, ".next", "standalone");
  if (!existsSync(source)) {
    throw new Error(".next/standalone introuvable — lancez `npm run app:build` avant l'empaquetage.");
  }
  const dest = path.join(context.appOutDir, "resources", "standalone");
  rmSync(dest, { recursive: true, force: true });
  cpSync(source, dest, { recursive: true });
  console.log(`  afterPack : serveur copié dans ${path.relative(context.packager.projectDir, dest)}`);
};
