// File d'attente d'analyse des factures — EN ARRIÈRE-PLAN.
//
// Le serveur de l'application est un unique processus Node : on sérialise les
// analyses (une à la fois) pour borner la mémoire (l'OCR d'un scan peut consommer
// beaucoup), et on ne bloque JAMAIS la requête qui a déposé les fichiers.
//
// Robustesse : si le processus s'arrête au milieu d'une analyse, la facture reste
// au statut « analyse_en_cours » ; `resumeStuckAnalyses()` la remet en file au
// démarrage suivant (le fichier d'origine est toujours sur disque).

import { prisma } from "@/lib/db";
import { applyAnalysis, type AnalyzeMode } from "./analyze";

type Job = { id: string; mode: AnalyzeMode; userName?: string };

const queue: Job[] = [];
const queued = new Set<string>();
let running = false;

/** Ajoute une facture à la file d'analyse (sans doublon) et lance le traitement. */
export function enqueueAnalysis(id: string, mode: AnalyzeMode = "import", userName?: string): void {
  if (queued.has(id)) return;
  queued.add(id);
  queue.push({ id, mode, userName });
  void drain();
}

async function drain(): Promise<void> {
  if (running) return;
  running = true;
  try {
    let job: Job | undefined;
    while ((job = queue.shift())) {
      try {
        await applyAnalysis(job.id, job.mode, job.userName);
      } catch (e) {
        console.error(`File d'analyse : échec sur ${job.id}`, e);
        await prisma.invoice
          .update({ where: { id: job.id }, data: { status: "erreur" } })
          .catch(() => {});
      } finally {
        queued.delete(job.id);
      }
    }
  } finally {
    running = false;
  }
}

/** Nombre de factures en attente / en cours d'analyse dans ce processus. */
export function pendingAnalysisCount(): number {
  return queue.length + (running ? 1 : 0);
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
