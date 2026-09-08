// Analyse d'une facture déjà enregistrée (le fichier est sur disque, la ligne
// existe en base) : lecture du document -> extraction -> mise à jour de la ligne.
//
// Séparé de l'import pour pouvoir tourner EN ARRIÈRE-PLAN (file d'attente) : le
// dépôt de fichiers ne doit jamais bloquer l'utilisateur pendant l'OCR.

import { readFile } from "node:fs/promises";
import { prisma } from "@/lib/db";
import { resolveUploadPath } from "@/lib/paths";
import { getInvoiceParser } from "@/lib/parsing";
import { checkCoherence, storedCoherence } from "@/lib/tva/coherence";
import { resolveParty } from "@/lib/invoices/party";
import { duplicateKey } from "@/lib/invoices/duplicates";
import { reconcileStatements } from "@/lib/invoices/statements";
import { diffInvoice } from "@/lib/domain/revisions";
import type { ParsedInvoice } from "@/lib/parsing/types";

const IMAGE_EXT = /\.(jpe?g|png|webp|tiff?|bmp|heic|heif)$/i;

function mimeFor(fileName: string | null | undefined): string | undefined {
  const m = (fileName ?? "").match(IMAGE_EXT)?.[0].toLowerCase();
  if (!m) return undefined;
  if (/jpe?g/.test(m)) return "image/jpeg";
  if (m === ".png") return "image/png";
  if (m === ".webp") return "image/webp";
  if (/tiff?/.test(m)) return "image/tiff";
  return "image/*";
}

const STUB: ParsedInvoice = {
  confidence: 0,
  engine: "stub",
  amountsUncertain: true,
  warnings: ["Impossible de lire automatiquement ce document. Veuillez saisir les informations manuellement."],
};

/**
 * - "import"     : 1re analyse d'un document qui vient d'être déposé (rien à préserver).
 * - "reanalyze"  : l'utilisateur a demandé une nouvelle analyse -> on préserve les
 *                  valeurs existantes que l'analyseur ne retrouve pas, et on
 *                  journalise les changements.
 * - "resume"     : analyse interrompue (application fermée / plantée) reprise au
 *                  démarrage. On ne sait plus si c'était un import ou une
 *                  ré-analyse : on préserve donc l'existant (une facture déjà
 *                  corrigée à la main ne doit pas être remise à zéro), sans
 *                  journaliser — l'utilisateur n'a rien demandé.
 */
export type AnalyzeMode = "import" | "reanalyze" | "resume";

/** Note posée à l'import, en attendant l'analyse. Ne vaut pas une saisie de l'utilisateur. */
export const ANALYSIS_PENDING_NOTE = "Analyse automatique en cours…";

/**
 * Ce que le mode autorise :
 * - `keepExisting` : préserver une valeur déjà en base que l'analyseur ne retrouve pas.
 * - `journal`      : inscrire les changements au journal des modifications.
 *
 * Seul un PREMIER import peut repartir d'une page blanche : dans tous les autres
 * cas la facture peut déjà contenir une saisie de l'utilisateur.
 */
export function analysisModeFlags(mode: AnalyzeMode): { keepExisting: boolean; journal: boolean } {
  return { keepExisting: mode !== "import", journal: mode === "reanalyze" };
}

/**
 * L'analyse a-t-elle encore le droit d'écrire ses résultats ?
 *
 * Import et « Ré-analyser » placent tous deux la facture en « analyse_en_cours »
 * avant de la mettre en file. Tout autre statut à l'arrivée signifie qu'un humain
 * est intervenu pendant l'analyse : c'est LUI qui fait autorité.
 */
export function analysisMayWrite(statusNow: string): boolean {
  return statusNow === "analyse_en_cours";
}

/**
 * Délai maximum ABSOLU pour l'analyse d'un document. Dernier filet de sécurité :
 * quoi qu'il arrive en dessous (OCR figé, worker mort, PDF pathologique), une
 * analyse se termine — sinon elle occuperait une place de la file d'attente pour
 * toujours et plus aucun document ne serait traité.
 */
const ANALYSIS_TIMEOUT_MS = 4 * 60_000;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("délai d'analyse dépassé")), ms);
    p.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); },
    );
  });
}

/**
 * (Ré)analyse la facture `id` et met à jour sa ligne. Ne lève jamais : en cas
 * d'échec la facture passe au statut « erreur » avec une note explicative.
 * @param mode  voir AnalyzeMode.
 * @param userName  auteur des lignes de journal (ré-analyse manuelle).
 */
export async function applyAnalysis(id: string, mode: AnalyzeMode, userName?: string): Promise<void> {
  let inv = await prisma.invoice.findUnique({ where: { id }, include: { vatLines: true } });
  if (!inv) return;

  const src = resolveUploadPath(inv.originalFilePath);
  let parsed: ParsedInvoice = STUB;
  try {
    if (!src) throw new Error("document introuvable");
    const buffer = await readFile(src);
    parsed = await withTimeout(
      getInvoiceParser().parse({
        fileBuffer: buffer,
        fileName: inv.originalFileName ?? "document",
        mimeType: mimeFor(inv.originalFileName),
      }),
      ANALYSIS_TIMEOUT_MS,
    );
  } catch (e) {
    console.error(`Analyse de la facture ${id} impossible :`, e);
    const timedOut = e instanceof Error && /délai/i.test(e.message);
    await prisma.invoice
      .update({
        where: { id },
        data: {
          status: "erreur",
          coherence: "a_verifier",
          notes: timedOut
            ? "L'analyse automatique a pris trop de temps et a été interrompue. " +
              "Le document est bien enregistré : saisissez les montants via « Modifier », ou relancez l'analyse."
            : "L'analyse automatique a échoué. Saisissez les informations via « Modifier ».",
        },
      })
      .catch(() => {});
    return;
  }

  // -------------------------------------------------------------------------
  //  GARDE-FOU : l'analyse ne doit JAMAIS écraser une saisie de l'utilisateur.
  //
  //  L'analyse (OCR) dure plusieurs secondes, parfois plusieurs minutes. Pendant
  //  ce temps, l'utilisateur peut très bien ouvrir la facture et saisir les
  //  montants lui-même — c'est même le réflexe naturel quand l'analyse traîne.
  //  Sa correction faisait alors passer la facture en « à vérifier »... puis
  //  l'analyse se terminait et remettait numéro, montants, dates et lignes de
  //  TVA à zéro, sans laisser la moindre trace.
  //
  //  Les deux seuls points d'entrée (import et « Ré-analyser ») mettent la
  //  facture en « analyse_en_cours » AVANT de la mettre en file : si ce n'est
  //  plus le cas ici, quelqu'un d'autre est passé par là et c'est LUI qui fait
  //  autorité. On abandonne le résultat de l'analyse, en le disant.
  // -------------------------------------------------------------------------
  const current = await prisma.invoice.findUnique({ where: { id }, include: { vatLines: true } });
  if (!current) return; // supprimée entre-temps
  if (!analysisMayWrite(current.status)) {
    console.warn(`Analyse de ${id} abandonnée : la facture a été modifiée pendant l'analyse.`);
    await prisma.invoiceRevision
      .create({
        data: {
          invoiceId: id,
          field: "Analyse automatique",
          oldValue: "résultat ignoré",
          newValue: "la facture a été modifiée pendant l'analyse : vos saisies ont été conservées",
        },
      })
      .catch(() => {});
    return;
  }
  // À partir d'ici on travaille sur la version FRAÎCHE de la facture, pas sur
  // celle lue avant l'analyse (qui peut avoir plusieurs minutes de retard).
  inv = current;

  const { keepExisting, journal } = analysisModeFlags(mode);

  // Un relevé de factures : le parseur le repère ; en ré-analyse on ne retire
  // jamais le drapeau tout seul (l'utilisateur le corrige via la fiche).
  const isStatement = parsed.isStatement === true || (keepExisting && inv.isStatement);
  const newStatementLines =
    parsed.isStatement && parsed.statementLines?.length
      ? parsed.statementLines
      : null;

  const totalHT = parsed.totalHT ?? (keepExisting ? inv.totalHT : 0);
  const totalVAT = parsed.totalVAT ?? (keepExisting ? inv.totalVAT : 0);
  const totalTTC = parsed.totalTTC ?? (keepExisting ? inv.totalTTC : 0);
  const vatLines = parsed.vatLines?.length
    ? parsed.vatLines.map((l) => ({ rate: l.rate, baseHT: l.baseHT, vatAmount: l.vatAmount }))
    : keepExisting
      ? inv.vatLines.map((l) => ({ rate: l.rate, baseHT: l.baseHT, vatAmount: l.vatAmount }))
      : [];

  const documentType = parsed.documentType ?? (inv.documentType as "facture" | "avoir");
  const invoiceDate = parsed.invoiceDate ? new Date(parsed.invoiceDate) : keepExisting ? inv.invoiceDate : new Date();
  const dueDate = parsed.dueDate ? new Date(parsed.dueDate) : keepExisting ? inv.dueDate : null;

  const coherence = storedCoherence(
    checkCoherence({
      totalHT, totalVAT, totalTTC, vatLines,
      documentType,
      invoiceDate: parsed.invoiceDate ?? undefined,
      dueDate: dueDate ? dueDate.toISOString().slice(0, 10) : undefined,
    }),
    { amountsUncertain: parsed.amountsUncertain === true, hasAmounts: Boolean(totalHT || totalTTC) },
  );

  const party = await resolveParty(prisma, {
    name: parsed.partyName ?? inv.partyName,
    address: parsed.partyAddress ?? inv.partyAddress,
    siret: parsed.siret ?? inv.siret,
    vatNumber: parsed.vatNumber ?? inv.vatNumber,
    direction: inv.direction,
  });

  const warnings = [...parsed.warnings];
  if (!parsed.invoiceDate && !keepExisting) {
    warnings.unshift("⚠️ Date de facture NON détectée : la date du jour a été mise par défaut, corrigez-la avant de valider.");
  }

  // Doublon (numéro normalisé, ou tiers + date + TTC).
  const key = duplicateKey({ id, number: parsed.number ?? inv.number, partyName: party.partyName, invoiceDate, totalTTC });
  if (key) {
    const others = await prisma.invoice.findMany({
      where: { id: { not: id } },
      select: { id: true, number: true, partyName: true, invoiceDate: true, totalTTC: true },
    });
    if (others.some((o) => duplicateKey({ ...o }) === key)) {
      warnings.unshift(
        "⚠️ Une facture très semblable existe déjà (même numéro/tiers, ou même tiers + date + montant). Vérifiez qu'il ne s'agit pas d'un doublon.",
      );
    }
  }

  const data = {
    documentType,
    number: parsed.number ?? (keepExisting ? inv.number : null),
    invoiceDate,
    dueDate,
    partyId: party.partyId,
    partyName: party.partyName,
    partyAddress: party.partyAddress,
    siret: party.siret,
    vatNumber: party.vatNumber,
    currency: parsed.currency ?? inv.currency,
    totalHT,
    totalVAT,
    totalTTC,
    isStatement,
    // Cumul imprimé sur le relevé (avant compensation) — sert de base au recalcul.
    statementGrossHT: isStatement ? (parsed.totalHT ?? inv.statementGrossHT ?? null) : null,
    statementGrossVAT: isStatement ? (parsed.totalVAT ?? inv.statementGrossVAT ?? null) : null,
    statementGrossTTC: isStatement ? (parsed.totalTTC ?? inv.statementGrossTTC ?? null) : null,
    status: parsed.confidence > 0 ? "a_verifier" : "a_analyser",
    coherence,
    confidence: parsed.confidence,
  };

  const revisions =
    journal
      ? diffInvoice(
          { ...inv, vatLines: inv.vatLines.map((l) => ({ rate: l.rate, baseHT: l.baseHT, vatAmount: l.vatAmount })) } as Record<string, unknown>,
          { ...inv, ...data, vatLines } as Record<string, unknown>,
        )
      : [];

  await prisma.$transaction([
    prisma.vatLine.deleteMany({ where: { invoiceId: id } }),
    // Lignes du relevé : remplacées si le parseur en a extrait ; sinon on garde
    // celles déjà en base (ré-analyse) ou on nettoie (ce n'est plus un relevé).
    ...(newStatementLines || !isStatement
      ? [prisma.statementLine.deleteMany({ where: { statementId: id } })]
      : []),
    prisma.invoice.update({
      where: { id },
      data: {
        ...data,
        // La note d'attente posée à l'import n'est pas une saisie : on ne la garde
        // jamais (sinon une facture analysée resterait « analyse en cours… »).
        notes: warnings.length
          ? warnings.join("\n")
          : keepExisting && inv.notes !== ANALYSIS_PENDING_NOTE
            ? inv.notes
            : null,
        vatLines: vatLines.length ? { create: vatLines } : undefined,
        statementLines: newStatementLines
          ? {
              create: newStatementLines.map((l) => ({
                reference: l.reference,
                label: l.label ?? null,
                lineDate: l.date ? new Date(l.date) : null,
                dueDate: l.dueDate ? new Date(l.dueDate) : null,
                amountHT: l.amountHT ?? null,
                amountVAT: l.amountVAT ?? null,
                amountTTC: l.amountTTC ?? null,
              })),
            }
          : undefined,
      },
    }),
    ...(journal
      ? [
          prisma.invoiceRevision.create({
            data: {
              invoiceId: id,
              field: "Analyse automatique",
              oldValue: inv.status,
              newValue: `relancée (confiance ${Math.round(parsed.confidence * 100)} %)`,
              userName: userName ?? null,
            },
          }),
          ...revisions.map((r) =>
            prisma.invoiceRevision.create({
              data: { invoiceId: id, field: r.field, oldValue: r.oldValue, newValue: r.newValue, userName: userName ?? null },
            }),
          ),
        ]
      : []),
  ]);

  // Rapproche les relevés : soit CETTE facture est un relevé (calcul de sa
  // compensation), soit c'est une facture qui figure peut-être sur un relevé
  // existant (qui doit alors rétrécir). Ne lève jamais.
  try {
    await reconcileStatements(prisma);
  } catch (e) {
    console.error(`Rapprochement des relevés impossible après analyse de ${id} :`, e);
  }
}
