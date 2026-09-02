// Chiffrement au repos du dossier de données (application installée uniquement).
//
//  - AES-256-GCM sur chaque fichier sensible (base, PDF, sauvegardes, corbeille,
//    clé de session).
//  - La clé AES est tirée au sort une fois, puis protégée par le compte Windows
//    (Electron safeStorage → DPAPI). Un dossier de données copié sur une autre
//    machine ou ouvert par un autre compte Windows est illisible.
//  - Au démarrage : déchiffrement vers des fichiers de travail. À la fermeture :
//    re-chiffrement et suppression des fichiers en clair.
//
//  Le fichier en clair n'existe que pendant que l'application tourne (session
//  ouverte et authentifiée). Pour une protection même « application ouverte »,
//  activer en plus le chiffrement de disque Windows (BitLocker).

const { safeStorage } = require("electron");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const MARKER = "chiffrement.actif";
const KEYFILE = "chiffrement.cle";

// Cibles à chiffrer (relatives au dossier de données). Les dossiers sont récursifs.
const TARGET_FILES = ["facturation.db", "auth-secret.txt"];
const TARGET_DIRS = ["factures-pdf", "sauvegardes", "corbeille"];

function markerPath(dataDir) {
  return path.join(dataDir, MARKER);
}

function isRequested(dataDir) {
  return fs.existsSync(markerPath(dataDir));
}

function available() {
  try {
    return safeStorage.isEncryptionAvailable();
  } catch {
    return false;
  }
}

function loadKey(dataDir) {
  const kp = path.join(dataDir, KEYFILE);
  if (fs.existsSync(kp)) {
    return Buffer.from(safeStorage.decryptString(fs.readFileSync(kp)), "hex");
  }
  const key = crypto.randomBytes(32);
  fs.writeFileSync(kp, safeStorage.encryptString(key.toString("hex")), { mode: 0o600 });
  return key;
}

function encryptFile(plainPath, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(fs.readFileSync(plainPath)), cipher.final()]);
  fs.writeFileSync(plainPath + ".enc", Buffer.concat([iv, cipher.getAuthTag(), data]));
  fs.rmSync(plainPath);
}

function decryptFile(encPath, key) {
  const buf = fs.readFileSync(encPath);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, buf.subarray(0, 12));
  decipher.setAuthTag(buf.subarray(12, 28));
  const plain = Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]);
  fs.writeFileSync(encPath.replace(/\.enc$/, ""), plain);
  fs.rmSync(encPath);
}

function* walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

function eachTarget(dataDir) {
  const list = [];
  for (const f of TARGET_FILES) list.push(path.join(dataDir, f));
  for (const d of TARGET_DIRS) for (const f of walk(path.join(dataDir, d))) list.push(f);
  return list;
}

/**
 * Déchiffre le dossier de données. Renvoie une fonction `lock()` qui re-chiffre
 * tout et supprime les fichiers en clair (à appeler à la fermeture).
 */
function unlock(dataDir) {
  const key = loadKey(dataDir);

  // Déchiffre : pour chaque cible chiffrée, produit le fichier en clair.
  for (const f of TARGET_FILES) {
    const enc = path.join(dataDir, f + ".enc");
    if (fs.existsSync(enc)) decryptFile(enc, key);
  }
  for (const d of TARGET_DIRS) {
    for (const f of [...walk(path.join(dataDir, d))]) {
      if (f.endsWith(".enc")) decryptFile(f, key);
    }
  }

  return function lock() {
    for (const f of eachTarget(dataDir)) {
      if (fs.existsSync(f) && !f.endsWith(".enc")) {
        try {
          encryptFile(f, key);
        } catch (e) {
          console.error("Chiffrement de " + f + " impossible :", e);
        }
      }
    }
  };
}

module.exports = { isRequested, available, unlock, MARKER };
