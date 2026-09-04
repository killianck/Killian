// Pool de workers Tesseract PERSISTANTS.
//
// Créer un worker tesseract.js coûte cher : moteur WASM + décompression des
// ~14 Mo de données de langue françaises (plusieurs secondes). Avant, c'était
// fait pour CHAQUE document.
//
// Ici : un petit pool (2 par défaut) de workers gardés vivants pour toute la
// durée du processus et réutilisés par toutes les analyses. Un worker qui a
// planté est jeté et recréé au coup suivant.

import path from "node:path";
import { existsSync } from "node:fs";
import type { Worker } from "tesseract.js";

const POOL_SIZE = Math.max(1, Number(process.env.OCR_WORKERS) || 2);

type Slot = { worker: Worker | null; busy: boolean; creating: Promise<void> | null };

// Le pool survit au rechargement à chaud de Next en dev (évite des workers
// orphelins), et est unique pour toute la durée du processus en production.
const g = globalThis as unknown as { __ocrPool?: Slot[] };
const pool: Slot[] =
  g.__ocrPool ?? (g.__ocrPool = Array.from({ length: POOL_SIZE }, () => ({ worker: null, busy: false, creating: null })));

const waiters: Array<(s: Slot) => void> = [];
let langMissing = false;

function tessdataDir(): string | undefined {
  const candidates = [
    process.env.TESSDATA_DIR,
    path.join(process.cwd(), "tessdata"),
    path.join(process.cwd(), "src", "lib", "parsing", "tessdata"),
    path.join(__dirname, "tessdata"),
    path.join(__dirname, "..", "..", "..", "src", "lib", "parsing", "tessdata"),
  ].filter((d): d is string => Boolean(d));
  return candidates.find((dir) => existsSync(path.join(dir, "fra.traineddata.gz")));
}

async function spawn(slot: Slot): Promise<void> {
  const langPath = tessdataDir();
  if (!langPath) {
    langMissing = true;
    return;
  }
  const { createWorker } = await import("tesseract.js");
  const w = await createWorker("fra", 1, { langPath, cacheMethod: "none", gzip: true });
  await w.setParameters({
    preserve_interword_spaces: "1", // garde l'alignement des colonnes de montants
    tessedit_do_invert: "0", // factures sur fond clair : pas d'essai d'inversion
  });
  slot.worker = w;
}

async function ensure(slot: Slot): Promise<void> {
  if (slot.worker || langMissing) return;
  if (!slot.creating) {
    slot.creating = spawn(slot)
      .catch((e) => console.error("Création d'un worker OCR impossible :", e))
      .finally(() => { slot.creating = null; });
  }
  await slot.creating;
}

/** Réserve un worker, exécute `fn`, puis le libère. null si langue absente. */
export async function withOcrWorker<T>(fn: (w: Worker) => Promise<T>): Promise<T | null> {
  const slot = await acquire();
  if (!slot) return null;
  try {
    await ensure(slot);
    if (!slot.worker) return null;
    return await fn(slot.worker);
  } catch (e) {
    // Worker potentiellement corrompu : on le recycle.
    const dead = slot.worker;
    slot.worker = null;
    if (dead) await dead.terminate().catch(() => {});
    throw e;
  } finally {
    release(slot);
  }
}

function acquire(): Promise<Slot | null> {
  if (langMissing) return Promise.resolve(null);
  const free = pool.find((s) => !s.busy);
  if (free) {
    free.busy = true;
    return Promise.resolve(free);
  }
  return new Promise((resolve) => waiters.push((s) => resolve(s)));
}

function release(slot: Slot): void {
  const next = waiters.shift();
  if (next) next(slot);
  else slot.busy = false;
}

/** Pré-charge les workers en arrière-plan (au démarrage d'un lot d'analyses). */
export function warmOcrWorkers(): void {
  for (const slot of pool) void ensure(slot);
}
