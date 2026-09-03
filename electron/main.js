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
//  À la fermeture : arrêt PROPRE du serveur puis re-chiffrement des données.
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

// Dossier de données FIXE, indépendant de app.getName() (qui pourrait changer
// avec productName) : garantit qu'une mise à jour ne « perd » jamais les données.
if (!isDev) {
  try {
    app.setPath("userData", path.join(app.getPath("appData"), "facturation-tva"));
  } catch {
    /* getPath peut échouer très tôt sur certaines plateformes */
  }
}

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
let serverExitExpected = false;
let logStream = null;

// --- Journal sur disque (une app double-cliquée n'a pas de console) ---
function initLogger() {
  try {
    const logDir = app.getPath("logs");
    fs.mkdirSync(logDir, { recursive: true });
    const file = path.join(logDir, "main.log");
    // Rotation simple : au-delà de 2 Mo, on repart de zéro.
    try {
      if (fs.existsSync(file) && fs.statSync(file).size > 2 * 1024 * 1024) fs.rmSync(file);
    } catch {}
    logStream = fs.createWriteStream(file, { flags: "a" });
    const write = (level, args) => {
      try {
        logStream.write(`[${new Date().toISOString()}] ${level} ${args.map(String).join(" ")}\n`);
      } catch {}
    };
    for (const level of ["log", "info", "warn", "error"]) {
      const orig = console[level].bind(console);
      console[level] = (...a) => { orig(...a); write(level.toUpperCase(), a); };
    }
    console.log(`--- Démarrage v${app.getVersion()} ---`);
  } catch {
    /* pas de journal : on continue */
  }
}

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
      // Un arrêt du serveur pendant l'attente = échec immédiat (pas 40 s).
      if (serverProcess && serverProcess.exitCode !== null) {
        reject(new Error(`Le serveur s'est arrêté au démarrage (code ${serverProcess.exitCode}).`));
        return;
      }
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

/** Y a-t-il des fichiers chiffrés (.enc) dans le dossier de données ? */
function hasEncryptedData(dir) {
  const walk = (d) => {
    if (!fs.existsSync(d)) return false;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) { if (walk(full)) return true; }
      else if (e.name.endsWith(".enc")) return true;
    }
    return false;
  };
  return fs.existsSync(path.join(dir, "facturation.db.enc")) || walk(dir);
}

function setupUserData() {
  dataDir = app.getPath("userData");
  fs.mkdirSync(dataDir, { recursive: true });
  process.env.APP_DATA_DIR = dataDir;
  process.env.DESKTOP_APP = "1";
  process.env.TESSDATA_DIR = path.join(standaloneDir, "tessdata");

  // Déchiffrement des données si activé.
  if (dataEncryption.isRequested(dataDir)) {
    if (dataEncryption.available()) {
      try {
        lockData = dataEncryption.unlock(dataDir);
      } catch (e) {
        // Clé illisible (profil Windows reconstruit, autre session…). NE PAS
        // continuer sur une base vide : les données ne sont PAS perdues.
        throw new Error(
          "Vos données chiffrées n'ont pas pu être ouvertes sur cette session Windows. " +
            "Elles ne sont pas perdues. N'utilisez pas l'application et faites appel à un support technique. " +
            `(${e && e.message})`,
        );
      }
    } else if (hasEncryptedData(dataDir)) {
      throw new Error(
        "Le chiffrement des données est activé mais le système ne permet pas de les déchiffrer " +
          "sur cette session. Vos données ne sont pas perdues, mais l'application ne peut pas démarrer ici.",
      );
    } else {
      dialog.showErrorBox(
        "Chiffrement indisponible",
        "Le chiffrement est demandé mais le système ne le permet pas. Les données seront utilisées en clair.",
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
  for (const w of res.warnings || []) console.warn("Migration :", w);
  if (res.backup) console.log("Copie avant migration :", res.backup);
  if (!res.alreadyUpToDate) console.log(`Migrations appliquées : ${res.applied.join(", ")}`);
}

async function startEmbeddedServer() {
  const port = await findFreePort();
  serverExitExpected = false;
  serverProcess = fork(path.join(standaloneDir, "server.js"), [], {
    cwd: standaloneDir,
    env: { ...process.env, PORT: String(port), HOSTNAME: "127.0.0.1", NODE_ENV: "production" },
    stdio: ["ignore", "pipe", "pipe", "ipc"],
  });
  const relay = (buf) => { const s = String(buf).trimEnd(); if (s) console.log("[serveur]", s); };
  serverProcess.stdout?.on("data", relay);
  serverProcess.stderr?.on("data", relay);

  serverProcess.on("exit", (code, signal) => {
    if (serverExitExpected || app.isQuitting) return;
    console.error(`Serveur arrêté de façon inattendue (code ${code}, signal ${signal}).`);
    if (mainWindow && !mainWindow.isDestroyed()) {
      dialog
        .showMessageBox(mainWindow, {
          type: "error",
          buttons: ["Redémarrer l'application", "Quitter"],
          defaultId: 0,
          title: "Le service s'est arrêté",
          message: "Le moteur de l'application s'est arrêté. Un redémarrage est nécessaire.",
        })
        .then(({ response }) => {
          if (response === 0) { app.relaunch(); app.exit(0); }
          else app.quit();
        });
    }
  });

  serverUrl = `http://127.0.0.1:${port}`;
  await waitForServer(serverUrl);
}

/** Arrête proprement le serveur (attend sa fin) PUIS re-chiffre les données. */
function stopServerThenLock() {
  return new Promise((resolve) => {
    const finish = () => {
      if (lockData) {
        try { lockData(); } catch (e) { console.error("Re-chiffrement à la fermeture impossible :", e); }
        lockData = null;
      }
      resolve();
    };

    if (!serverProcess || serverProcess.exitCode !== null) return finish();
    serverExitExpected = true;
    const proc = serverProcess;
    serverProcess = null;

    const killTimer = setTimeout(() => { try { proc.kill("SIGKILL"); } catch {} }, 4000);
    const doneTimer = setTimeout(finish, 8000); // filet de sécurité absolu
    proc.once("exit", () => { clearTimeout(killTimer); clearTimeout(doneTimer); finish(); });
    try { proc.kill(); } catch { finish(); }
  });
}

function isSafeExternalUrl(url) {
  try { return /^https?:$/.test(new URL(url).protocol); } catch { return false; }
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
      sandbox: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  mainWindow.loadURL(serverUrl);

  const openExternal = (url) => {
    if (isSafeExternalUrl(url)) shell.openExternal(url);
  };

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(serverUrl)) {
      openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  // La fenêtre principale ne doit JAMAIS naviguer hors de l'application locale.
  mainWindow.webContents.on("will-navigate", (e, url) => {
    if (!url.startsWith(serverUrl)) {
      e.preventDefault();
      openExternal(url);
    }
  });

  mainWindow.on("closed", () => { mainWindow = null; });
}

async function bootstrap() {
  if (!isDev) {
    try {
      const { dbFile } = setupUserData();
      runMigrations(dbFile);
      await startEmbeddedServer();
    } catch (err) {
      console.error("Échec du démarrage :", err);
      dialog.showErrorBox(
        "Impossible de démarrer l'application",
        String(err && err.message ? err.message : err) + "\n\nVos données n'ont pas été modifiées.",
      );
      await stopServerThenLock().catch(() => {});
      app.exit(1);
      return;
    }
  } else {
    await waitForServer(DEV_URL).catch(() => {});
  }
  ipcMain.handle("app:version", () => app.getVersion());
  createWindow();

  if (!isDev) setupAutoUpdate(() => mainWindow);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  initLogger();

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
    app.isQuitting = true;
    e.preventDefault();
    stopServerThenLock().finally(() => {
      if (isUpdatePending()) quitAndInstall();
      else app.exit(0);
    });
  });

  // Fermeture de session Windows (arrêt / redémarrage) : on tente au moins de
  // re-chiffrer la base et le secret, rapidement.
  app.on("session-end", () => {
    if (isDev) return;
    try { if (lockData) lockData(); } catch {}
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });

  app.on("activate", () => {
    if (mainWindow === null && serverUrl) createWindow();
  });
}
