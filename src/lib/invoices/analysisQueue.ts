// File d'attente d'analyse des factures — EN ARRIÈRE-PLAN.
//
// Le serveur de l'application est un unique processus Node. On traite jusqu'à
// OCR_CONCURRENCY documents en parallèle (2 par défaut) — chacun sur son worker
// Tesseract persistant — pour aller vite sur un lot de scans, tout en bornant
// la mémoire. Le dépôt de fichiers ne bloque JAMAIS.
//
// Robustesse : si le processus s'arrête au milieu d'une analyse, la facture reste
// « analyse_en_cours » ; `resumeStuckAnalyses()` la remet en file au démarrage
// suivant (le fichier d'origine est toujours sur disque).

import { prisma } from "@/lib/db";
import { warmOcrWorkers } from "@/lib/parsing/ocrWorker";
import { applyAnalysis, type AnalyzeMode } from "./analyze";

type Job = { id: string; mode: AnalyzeMode; userName?: string };

const CONCURRENCY = Math.max(1, Number(process.env.OCR_CONCURRENCY) || 2);

const queue: Job[] = [];
const queued = new Set<string>();
let active = 0;

/** Ajoute une facture à la file d'analyse (sans doublon) et lance le traitement. */
export function enqueueAnalysis(id: string, mode: AnalyzeMode = "import", userName?: string): void {
  if (queued.has(id)) return;
  queued.add(id);
  queue.push({ id, mode, userName });
  warmOcrWorkers();
  pump();
}

function pump(): void {
  while (active < CONCURRENCY && queue.length) {
    const job = queue.shift()!;
    active++;
    void runJob(job).finally(() => {
      active--;
      queued.delete(job.id);
      pump();
    });
  }
}

async function runJob(job: Job): Promise<void> {
  try {
    await applyAnalysis(job.id, job.mode, job.userName);
  } catch (e) {
    console.error(`File d'analyse : échec sur ${job.id}`, e);
    await prisma.invoice.update({ where: { id: job.id }, data: { status: "erreur" } }).catch(() => {});
  }
}

/** Nombre de factures en attente ou en cours d'analyse dans ce processus. */
export function pendingAnalysisCount(): number {
  return queue.length + active;
}

let lastResume = 0;

/**
 * Remet en file les factures bloquées en « analyse_en_cours » : soit parce que
 * le processus a redémarré, soit parce qu'une analyse a été perdue. On ne touche
 * qu'aux factures inactives depuis > 2 min (les autres sont en cours).
 */
export async function resumeStuckAnalyses(): Promise<void> {
  const now = Date.now();
  if (now - lastResume < 30_000) return; // au plus une fois toutes les 30 s
  lastResume = now;

  const cutoff = new Date(now - 2 * 60_000);
  const stuck = await prisma.invoice.findMany({
    where: { status: "analyse_en_cours", updatedAt: { lt: cutoff } },
    select: { id: true },
  });
  for (const s of stuck) enqueueAnalysis(s.id, "import");
}
