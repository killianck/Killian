// Processus principal Electron : fenêtre de l'application + démarrage du serveur.
//
//  - En développement (`npm run app:dev`) : charge http://localhost:3000
//    (le serveur Next est lancé à part par `next dev`).
//  - En production (application installée) :
//      1. prépare le dossier de données de l'utilisateur (%APPDATA%\FacturationTVA)
//      2. applique les migrations de base de données en attente
//      3. démarre le serveur Next embarqué (.next/standalone)
//      4. ouvre la fenêtre sur ce serveur local
//
//  Aucune de ces étapes ne modifie le code : elles préparent seulement les
//  données locales de l'utilisateur.

const { app, BrowserWindow, shell, dialog } = require("electron");
const path = require("node:path");
const http = require("node:http");
const net = require("node:net");
const fs = require("node:fs");
const crypto = require("node:crypto");

const isDev = !app.isPackaged;
const DEV_URL = "http://localhost:3000";

// En production, le serveur Next et les migrations sont livrés à côté de l'app.
const resourcesPath = process.resourcesPath;
const standaloneDir = isDev ? process.cwd() : path.join(resourcesPath, "standalone");
const migrationsDir = isDev
  ? path.join(process.cwd(), "prisma", "migrations")
  : path.join(standaloneDir, "prisma", "migrations");

let mainWindow = null;
let serverUrl = DEV_URL;

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

function waitForServer(url, timeoutMs = 30000) {
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
  const dataDir = app.getPath("userData");
  fs.mkdirSync(dataDir, { recursive: true });
  process.env.APP_DATA_DIR = dataDir;

  const dbFile = path.join(dataDir, "facturation.db");
  process.env.DATABASE_URL = "file:" + dbFile;

  // Clé de signature des sessions, propre à cette installation.
  const secretFile = path.join(dataDir, "auth-secret.txt");
  if (fs.existsSync(secretFile)) {
    process.env.AUTH_SECRET = fs.readFileSync(secretFile, "utf8").trim();
  } else {
    const s = crypto.randomBytes(32).toString("hex");
    fs.writeFileSync(secretFile, s, { mode: 0o600 });
    process.env.AUTH_SECRET = s;
  }

  // Moteur Prisma livré avec l'application (fichier réel, hors asar).
  const engine = path.join(standaloneDir, "node_modules", ".prisma", "client", "query_engine-windows.dll.node");
  if (fs.existsSync(engine)) process.env.PRISMA_QUERY_ENGINE_LIBRARY = engine;

  return { dataDir, dbFile };
}

function runMigrations(dbFile) {
  // electron/migrate.cjs est généré au build à partir de src/lib/migrate.ts
  const { applyPendingMigrations } = require("./migrate.cjs");
  const res = applyPendingMigrations(dbFile, migrationsDir);
  if (!res.alreadyUpToDate) {
    console.log(`Migrations appliquées : ${res.applied.join(", ")}`);
  }
}

async function startEmbeddedServer() {
  const port = await findFreePort();
  process.env.PORT = String(port);
  process.env.HOSTNAME = "127.0.0.1";
  process.env.NODE_ENV = "production";
  process.chdir(standaloneDir);
  require(path.join(standaloneDir, "server.js")); // démarre l'écoute
  serverUrl = `http://127.0.0.1:${port}`;
  await waitForServer(serverUrl);
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
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });

  mainWindow.loadURL(serverUrl);

  // Les liens externes (ouvrir un PDF dans un onglet, etc.) vont au navigateur.
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
          "\n\nVos données n'ont pas été modifiées. Réessayez ou contactez le support.",
      );
      app.quit();
      return;
    }
  } else {
    await waitForServer(DEV_URL).catch(() => {});
  }
  createWindow();
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

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });

  app.on("activate", () => {
    if (mainWindow === null) createWindow();
  });
}
