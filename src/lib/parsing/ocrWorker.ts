// Pool de workers Tesseract PERSISTANTS.
//
// Créer un worker tesseract.js coûte cher : moteur WASM + décompression des
// ~14 Mo de données de langue françaises (plusieurs secondes). Avant, c'était
// fait pour CHAQUE document.
//
// Ici : un petit pool (2 par défaut) de workers gardés vivants pour toute la
// durée du processus et réutilisés par toutes les analyses. Un worker qui a
// planté est jeté et recréé au coup suivant.
//
// ⚠️ RÈGLE DE SURVIE : aucune attente ne doit être infinie. Un worker qui meurt
//    (module manquant dans le paquet, WASM corrompu…) peut ne JAMAIS répondre —
//    ni à `recognize`, ni à `terminate`, ni même à sa création. Sans délai
//    maximum, les emplacements du pool restent « occupés » pour toujours et
//    TOUTE la file d'analyse se fige : l'utilisateur voit « analyse en cours »
//    indéfiniment. Chaque attente ci-dessous est donc bornée.

import path from "node:path";
import { existsSync } from "node:fs";
import type { Worker } from "tesseract.js";

const POOL_SIZE = Math.max(1, Number(process.env.OCR_WORKERS) || 2);
/** Attente maximale d'un emplacement libre dans le pool. */
const ACQUIRE_TIMEOUT_MS = 90_000;
/** Création d'un worker (moteur WASM + langue) : lente, mais pas infinie. */
const SPAWN_TIMEOUT_MS = 60_000;
/** Un worker planté peut ne jamais accuser réception de `terminate`. */
const TERMINATE_TIMEOUT_MS = 5_000;
/** Au-delà, l'OCR est considéré indisponible et mis en pause (échec immédiat). */
const MAX_CONSECUTIVE_FAILURES = 3;
const DISABLE_MS = 5 * 60_000;

type Slot = { worker: Worker | null; busy: boolean; creating: Promise<void> | null };
/** Renvoie true si le waiter a bien pris le slot (false = il a abandonné). */
type Waiter = (slot: Slot) => boolean;

// Le pool survit au rechargement à chaud de Next en dev (évite des workers
// orphelins), et est unique pour toute la durée du processus en production.
const g = globalThis as unknown as { __ocrPool?: Slot[] };
const pool: Slot[] =
  g.__ocrPool ?? (g.__ocrPool = Array.from({ length: POOL_SIZE }, () => ({ worker: null, busy: false, creating: null })));

const waiters: Waiter[] = [];
let langMissing = false;
let consecutiveFailures = 0;
let disabledUntil = 0;

function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`délai dépassé : ${what}`)), ms);
    p.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); },
    );
  });
}

/** L'OCR est-il hors service (langue absente, ou trop d'échecs récents) ? */
export function ocrUnavailable(): boolean {
  return langMissing || Date.now() < disabledUntil;
}

function noteFailure(): void {
  consecutiveFailures += 1;
  if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
    consecutiveFailures = 0;
    disabledUntil = Date.now() + DISABLE_MS;
    console.error(
      "Reconnaissance de texte suspendue 5 minutes après plusieurs échecs consécutifs " +
        "(installation incomplète ?). Les documents sont enregistrés sans analyse automatique.",
    );
  }
}

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
  if (slot.worker || ocrUnavailable()) return;
  if (!slot.creating) {
    slot.creating = withTimeout(spawn(slot), SPAWN_TIMEOUT_MS, "création d'un worker OCR")
      .catch((e) => {
        console.error("Création d'un worker OCR impossible :", e);
        noteFailure();
      })
      .finally(() => { slot.creating = null; });
  }
  await slot.creating;
}

/** Réserve un worker, exécute `fn`, puis le libère. null si l'OCR est indisponible. */
export async function withOcrWorker<T>(fn: (w: Worker) => Promise<T>): Promise<T | null> {
  const slot = await acquire();
  if (!slot) return null;
  try {
    await ensure(slot);
    if (!slot.worker) return null;
    const out = await fn(slot.worker);
    consecutiveFailures = 0; // un succès remet le compteur à zéro
    return out;
  } catch (e) {
    // Worker potentiellement corrompu : on le recycle. On n'ATTEND PAS la fin de
    // `terminate` (un worker mort peut ne jamais répondre) — sinon l'emplacement
    // ne serait jamais rendu au pool.
    const dead = slot.worker;
    slot.worker = null;
    if (dead) void withTimeout(dead.terminate(), TERMINATE_TIMEOUT_MS, "arrêt du worker OCR").catch(() => {});
    noteFailure();
    throw e;
  } finally {
    release(slot);
  }
}

function acquire(): Promise<Slot | null> {
  if (ocrUnavailable()) return Promise.resolve(null);
  const free = pool.find((s) => !s.busy);
  if (free) {
    free.busy = true;
    return Promise.resolve(free);
  }
  // Pool saturé : on attend, mais jamais indéfiniment.
  return new Promise<Slot | null>((resolve) => {
    let settled = false;
    const waiter: Waiter = (slot) => {
      if (settled) return false; // ce demandeur a déjà abandonné : slot non pris
      settled = true;
      clearTimeout(timer);
      resolve(slot);
      return true;
    };
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      const i = waiters.indexOf(waiter);
      if (i >= 0) waiters.splice(i, 1);
      console.error("Aucun worker OCR disponible dans le délai imparti — document analysé sans OCR.");
      resolve(null);
    }, ACQUIRE_TIMEOUT_MS);
    waiters.push(waiter);
  });
}

function release(slot: Slot): void {
  // On saute les demandeurs qui ont abandonné entre-temps, sinon l'emplacement
  // serait remis à un waiter mort et perdu pour tout le monde.
  while (waiters.length) {
    const next = waiters.shift()!;
    if (next(slot)) return; // repris par un demandeur vivant : reste « busy »
  }
  slot.busy = false;
}

/** Pré-charge les workers en arrière-plan (au démarrage d'un lot d'analyses). */
export function warmOcrWorkers(): void {
  if (ocrUnavailable()) return;
  for (const slot of pool) void ensure(slot);
}
