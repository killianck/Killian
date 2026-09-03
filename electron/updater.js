// Mise à jour automatique de l'application (electron-updater).
//
//  Au démarrage, l'app vérifie s'il existe une version plus récente publiée
//  (GitHub Releases). Si oui, elle la télécharge en arrière-plan puis propose
//  de l'installer — jamais en silence : l'utilisateur clique « Redémarrer ».
//
//  L'état de la vérification est aussi transmis à la fenêtre (Paramètres →
//  « Version de l'application ») et l'utilisateur peut relancer une vérification.
//
//  Ne fait rien en développement ni si aucune publication n'est configurée.

const { autoUpdater } = require("electron-updater");
const { app, dialog, ipcMain } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

let updatePending = false;
let getWindowRef = () => null;
// états : "inactif" | "verification" | "a-jour" | "telechargement" | "prete" | "erreur" | "non-configure"
let lastStatus = { state: "inactif" };

function emit(status) {
  lastStatus = status;
  const win = getWindowRef();
  if (win && !win.isDestroyed()) {
    win.webContents.send("app:update-status", status);
  }
}

/** L'emplacement de publication est-il configuré (dépôt GitHub réel) ? */
function updateConfigured() {
  try {
    const yml = fs.readFileSync(path.join(process.resourcesPath, "app-update.yml"), "utf8");
    return !/VOTRE-COMPTE-GITHUB/i.test(yml);
  } catch {
    return false;
  }
}

function registerIpc() {
  ipcMain.handle("app:update-status", () => lastStatus);
  ipcMain.handle("app:check-updates", async () => {
    if (!updateConfigured()) {
      emit({ state: "non-configure" });
      return lastStatus;
    }
    try {
      emit({ state: "verification" });
      await autoUpdater.checkForUpdates();
    } catch (err) {
      emit({ state: "erreur", message: err && err.message });
    }
    return lastStatus;
  });
}

function setupAutoUpdate(getWindow) {
  getWindowRef = getWindow;
  registerIpc();

  if (!updateConfigured()) {
    emit({ state: "non-configure" });
    console.log("Mise à jour automatique : dépôt de publication non configuré (voir DEPLOIEMENT.md).");
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = false; // on gère nous-mêmes (chiffrement d'abord)

  autoUpdater.on("checking-for-update", () => emit({ state: "verification" }));
  autoUpdater.on("update-available", (info) =>
    emit({ state: "telechargement", version: info && info.version }),
  );
  autoUpdater.on("update-not-available", () => emit({ state: "a-jour" }));
  autoUpdater.on("download-progress", (p) =>
    emit({ state: "telechargement", percent: Math.round(p.percent || 0) }),
  );

  autoUpdater.on("update-downloaded", async (info) => {
    updatePending = true;
    emit({ state: "prete", version: info && info.version });
    const win = getWindowRef();
    const { response } = await dialog.showMessageBox(win, {
      type: "info",
      buttons: ["Redémarrer maintenant", "Plus tard"],
      defaultId: 0,
      cancelId: 1,
      title: "Mise à jour disponible",
      message: `La version ${info.version} est prête à être installée.`,
      detail: "L'application va redémarrer. Vos données ne sont pas affectées.",
    });
    if (response === 0) {
      // on quitte proprement : before-quit fera le re-chiffrement puis l'install
      app.quit();
    }
  });

  autoUpdater.on("error", (err) => {
    // Hors ligne, release incomplète, etc.
    console.log("Mise à jour : vérification impossible —", err && err.message);
    emit({ state: "erreur", message: err && err.message });
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
    app.exit(0);
  }
}

module.exports = { setupAutoUpdate, isUpdatePending, quitAndInstall };
