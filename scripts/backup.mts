// Sauvegarde manuelle : `npm run backup`
// (la logique est dans src/lib/backup.ts, réutilisée par l'application)

import { runBackup } from "../src/lib/backup";

const { folder, fileCount } = runBackup();
console.log(`✅ Sauvegarde créée : ${folder}`);
console.log(`   ${fileCount} fichier(s) de base copié(s) + dossier des PDF.`);
