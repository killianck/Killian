// Pont sécurisé entre l'application web (fenêtre) et Electron.
// Expose uniquement quelques informations en lecture + le déclenchement d'une
// vérification de mise à jour. Aucune donnée utilisateur ne transite ici.

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktop", {
  /** Version installée de l'application (ex. "0.2.3"). */
  version: () => ipcRenderer.invoke("app:version"),
  /** Force une vérification de mise à jour maintenant. Renvoie l'état courant. */
  checkForUpdates: () => ipcRenderer.invoke("app:check-updates"),
  /** État connu de la mise à jour, sans relancer de vérification. */
  updateStatus: () => ipcRenderer.invoke("app:update-status"),
  /** S'abonne aux changements d'état de la mise à jour. Renvoie une fonction de désabonnement. */
  onUpdateStatus: (callback) => {
    const handler = (_event, status) => callback(status);
    ipcRenderer.on("app:update-status", handler);
    return () => ipcRenderer.removeListener("app:update-status", handler);
  },
});
