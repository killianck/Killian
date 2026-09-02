// Mise à jour automatique de l'application (electron-updater).
//
//  Au démarrage, l'app vérifie s'il existe une version plus récente publiée
//  (GitHub Releases). Si oui, elle la télécharge en arrière-plan puis propose
//  de l'installer — jamais en silence : l'utilisateur clique « Redémarrer ».
//
//  Ne fait rien en développement ni si aucune publication n'est configurée.

const { autoUpdater } = require("electron-updater");
const { app, dialog } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

let updatePending = false;

/** L'emplacement de publication est-il configuré (dépôt GitHub réel) ? */
function updateConfigured() {
  try {
    const yml = fs.readFileSync(path.join(process.resourcesPath, "app-update.yml"), "utf8");
    return !/VOTRE-COMPTE-GITHUB/i.test(yml);
  } catch {
    return false;
  }
}

function setupAutoUpdate(getWindow) {
  if (!updateConfigured()) {
    console.log("Mise à jour automatique : dépôt de publication non configuré (voir DEPLOIEMENT.md).");
    return;
  }
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = false; // on gère nous-mêmes (chiffrement d'abord)

  autoUpdater.on("update-downloaded", async (info) => {
    updatePending = true;
    const win = getWindow();
    const { response } = await dialog.showMessageBox(win, {
      type: "info",
      buttons: ["Redémarrer maintenant", "Plus tard"],
      defaultId: 0,
      cancelId: 1,
      title: "Mise à jour disponible",
      message: `La version ${info.version} est prête à être installée.`,
      detail: "Vos données ne sont pas affectées.",
    });
    if (response === 0) {
      // on quitte proprement : before-quit fera le re-chiffrement puis l'install
      require("electron").app.quit();
    }
  });

  autoUpdater.on("error", (err) => {
    // Pas de publication configurée, hors ligne, etc. : on ignore silencieusement.
    console.log("Mise à jour : vérification impossible —", err && err.message);
  });

  autoUpdater.checkForUpdates().catch(() => {});
}

function isUpdatePending() {
  return updatePending;
}

/** Installe la mise à jour téléchargée puis redémarre (appelé au tout dernier moment). */
function quitAndInstall() {
  try {
    autoUpdater.quitAndInstall(false, true);
  } catch {
    require("electron").app.exit(0);
  }
}

module.exports = { setupAutoUpdate, isUpdatePending, quitAndInstall };
