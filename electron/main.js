// Processus principal Electron : fenêtre de l'application + démarrage du serveur.
//
//  - En développement (`npm run app:dev`) : charge http://localhost:3000
//    (le serveur Next est lancé à part par `next dev`).
//  - En production (application installée) :
//      1. prépare le dossier de données de l'utilisateur (%APPDATA%\facturation-tva)
//      2. déchiffre les données si le chiffrement est activé
//      3. applique les migrations de base de données en attente
//      4. démarre le serveur Next embarqué (.next/standalone) dans un processus fils
//      5. ouvre la fenêtre sur ce serveur local
//  À la fermeture : arrêt du serveur puis re-chiffrement des données si activé.
//
//  Aucune de ces étapes ne modifie le code : elles préparent seulement les
//  données locales de l'utilisateur.

const { app, BrowserWindow, shell, dialog, safeStorage, ipcMain } = require("electron");
const path = require("node:path");
const http = require("node:http");
const net = require("node:net");
const fs = require("node:fs");
const crypto = require("node:crypto");
const { fork } = require("node:child_process");
const dataEncryption = require("./data-encryption");
const { setupAutoUpdate, isUpdatePending, quitAndInstall } = require("./updater");

const isDev = !app.isPackaged;
const DEV_URL = "http://localhost:3000";

const resourcesPath = process.resourcesPath;
const standaloneDir = isDev ? process.cwd() : path.join(resourcesPath, "standalone");
const migrationsDir = isDev
  ? path.join(process.cwd(), "prisma", "migrations")
  : path.join(standaloneDir, "prisma", "migrations");

let mainWindow = null;
let serverProcess = null;
let serverUrl = DEV_URL;
let lockData = null; // fonction de re-chiffrement à la fermeture
let dataDir = null;

function findFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

function waitForServer(url, timeoutMs = 40000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      http
        .get(url, (res) => {
          res.resume();
          resolve();
        })
        .on("error", () => {
          if (Date.now() - start > timeoutMs) reject(new Error("Le serveur ne répond pas."));
          else setTimeout(tryOnce, 300);
        });
    };
    tryOnce();
  });
}

function setupUserData() {
  dataDir = app.getPath("userData");
  fs.mkdirSync(dataDir, { recursive: true });
  process.env.APP_DATA_DIR = dataDir;
  process.env.DESKTOP_APP = "1";

  // Déchiffrement des données si activé.
  if (dataEncryption.isRequested(dataDir)) {
    if (dataEncryption.available()) {
      lockData = dataEncryption.unlock(dataDir);
    } else {
      dialog.showErrorBox(
        "Chiffrement indisponible",
        "Le chiffrement des données est activé mais le système ne le permet pas sur cette " +
          "session. Les données seront utilisées en clair.",
      );
    }
  }

  const dbFile = path.join(dataDir, "facturation.db");
  process.env.DATABASE_URL = "file:" + dbFile;

  const secretFile = path.join(dataDir, "auth-secret.txt");
  if (fs.existsSync(secretFile)) {
    process.env.AUTH_SECRET = fs.readFileSync(secretFile, "utf8").trim();
  } else {
    const s = crypto.randomBytes(32).toString("hex");
    fs.writeFileSync(secretFile, s, { mode: 0o600 });
    process.env.AUTH_SECRET = s;
  }

  const engine = path.join(standaloneDir, "node_modules", ".prisma", "client", "query_engine-windows.dll.node");
  if (fs.existsSync(engine)) process.env.PRISMA_QUERY_ENGINE_LIBRARY = engine;

  return { dbFile };
}

function runMigrations(dbFile) {
  const { applyPendingMigrations } = require("./migrate.cjs");
  const res = applyPendingMigrations(dbFile, migrationsDir);
  if (!res.alreadyUpToDate) console.log(`Migrations appliquées : ${res.applied.join(", ")}`);
}

async function startEmbeddedServer() {
  const port = await findFreePort();
  serverProcess = fork(path.join(standaloneDir, "server.js"), [], {
    cwd: standaloneDir,
    env: {
      ...process.env,
      PORT: String(port),
      HOSTNAME: "127.0.0.1",
      NODE_ENV: "production",
    },
    stdio: ["ignore", "inherit", "inherit", "ipc"],
  });
  serverUrl = `http://127.0.0.1:${port}`;
  await waitForServer(serverUrl);
}

function stopServerThenLock() {
  if (serverProcess && !serverProcess.killed) {
    try {
      serverProcess.kill();
    } catch {}
    serverProcess = null;
  }
  if (lockData) {
    try {
      lockData();
    } catch (e) {
      console.error("Re-chiffrement à la fermeture impossible :", e);
    }
    lockData = null;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    title: "Facturation & TVA",
    backgroundColor: "#f6f7f9",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  mainWindow.loadURL(serverUrl);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(serverUrl)) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

async function bootstrap() {
  if (!isDev) {
    try {
      const { dbFile } = setupUserData();
      runMigrations(dbFile);
      await startEmbeddedServer();
    } catch (err) {
      dialog.showErrorBox(
        "Impossible de démarrer l'application",
        String(err && err.message ? err.message : err) +
          "\n\nVos données n'ont pas été modifiées.",
      );
      stopServerThenLock();
      app.exit(1);
      return;
    }
  } else {
    await waitForServer(DEV_URL).catch(() => {});
  }
  ipcMain.handle("app:version", () => app.getVersion());
  createWindow();

  if (!isDev) {
    setupAutoUpdate(() => mainWindow);
  }
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(bootstrap);

  let quitting = false;
  app.on("before-quit", (e) => {
    if (quitting || isDev) return;
    quitting = true;
    e.preventDefault();
    stopServerThenLock(); // arrête le serveur + re-chiffre les données
    setTimeout(() => {
      if (isUpdatePending()) quitAndInstall();
      else app.exit(0);
    }, 200);
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });

  app.on("activate", () => {
    if (mainWindow === null && serverUrl) createWindow();
  });
}
