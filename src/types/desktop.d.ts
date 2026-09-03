// Pont exposé par Electron (electron/preload.js) dans l'application installée.
// Absent sur le site web classique.

export type DesktopUpdateStatus = {
  state:
    | "inactif"
    | "verification"
    | "a-jour"
    | "telechargement"
    | "prete"
    | "erreur"
    | "non-configure";
  version?: string;
  percent?: number;
  message?: string;
};

declare global {
  interface Window {
    desktop?: {
      version: () => Promise<string>;
      checkForUpdates: () => Promise<DesktopUpdateStatus>;
      updateStatus: () => Promise<DesktopUpdateStatus>;
      onUpdateStatus: (cb: (s: DesktopUpdateStatus) => void) => () => void;
    };
  }
}
