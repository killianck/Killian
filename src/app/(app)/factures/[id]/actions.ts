"use server";

import { mkdir, rename } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { prisma } from "@/lib/db";
import { dataDir, resolveUploadPath } from "@/lib/paths";
import { STATUSES, type Status } from "@/lib/domain/enums";
import { checkCoherence } from "@/lib/tva/coherence";
import { enqueueAnalysis } from "@/lib/invoices/analysisQueue";
import { reconcileStatements } from "@/lib/invoices/statements";
import { requireAdmin, requireUser } from "@/lib/auth";

const has = (obj: object, key: string) => Object.prototype.hasOwnProperty.call(obj, key);

function isoDay(d: Date | null | undefined): string | undefined {
  return d ? new Date(d).toISOString().slice(0, 10) : undefined;
}

/**
 * Change le statut d'une facture. La validation est REFUSÉE tant que les montants
 * sont incohérents (garde-fou serveur, en plus du bouton désactivé côté écran).
 */
export async function setInvoiceStatus(id: string, status: Status): Promise<void> {
  const me = await requireUser();
  if (!has(STATUSES, status)) return;

  const current = await prisma.invoice.findUnique({
    where: { id },
    select: { status: true, totalHT: true, totalVAT: true, totalTTC: true, documentType: true, invoiceDate: true, dueDate: true, vatLines: true },
  });
  if (!current || current.status === status) return;

  if (status === "validee") {
    const report = checkCoherence({
      totalHT: current.totalHT,
      totalVAT: current.totalVAT,
      totalTTC: current.totalTTC,
      vatLines: current.vatLines,
      documentType: current.documentType as "facture" | "avoir",
      invoiceDate: isoDay(current.invoiceDate),
      dueDate: isoDay(current.dueDate),
    });
    if (report.level === "incoherent") {
      redirect(`/factures/${id}?erreur=incoherence`);
    }
  }

  try {
    await prisma.$transaction([
      prisma.invoice.update({ where: { id }, data: { status } }),
      prisma.invoiceRevision.create({
        data: {
          invoiceId: id,
          field: "Statut",
          oldValue: STATUSES[current.status as Status] ?? current.status,
          newValue: STATUSES[status],
          userName: me.name,
        },
      }),
    ]);
  } catch (e) {
    unstable_rethrow(e);
    console.error("Changement de statut impossible :", e);
    redirect(`/factures/${id}?erreur=enregistrement`);
  }

  revalidatePath(`/factures/${id}`);
  revalidatePath("/factures");
}

/**
 * Supprime une facture. Le fichier d'origine n'est jamais effacé : il est déplacé
 * dans `data/corbeille/`. Le nom du fichier est assaini (anti-traversée).
 */
export async function deleteInvoice(id: string): Promise<void> {
  await requireAdmin();
  const inv = await prisma.invoice.findUnique({
    where: { id },
    select: { originalFilePath: true, originalFileName: true, number: true },
  });
  if (!inv) redirect("/factures");

  try {
    await prisma.invoice.delete({ where: { id } });
  } catch (e) {
    unstable_rethrow(e);
    console.error("Suppression impossible :", e);
    redirect(`/factures/${id}?erreur=suppression`);
  }

  const src = resolveUploadPath(inv.originalFilePath);
  if (src) {
    try {
      const trash = path.join(dataDir(), "corbeille");
      await mkdir(trash, { recursive: true });
      const rawName = inv.originalFileName ?? path.basename(src);
      const safeName = path.basename(rawName).replace(/[^\w.\- ]/g, "_") || "document";
      await rename(src, path.join(trash, `${Date.now()}-${safeName}`));
    } catch (e) {
      console.error("Déplacement du fichier vers la corbeille impossible :", e);
    }
  }

  // La facture supprimée figurait peut-être sur un relevé : celui-ci doit
  // « regrossir » de la part correspondante.
  try {
    await reconcileStatements(prisma);
  } catch (e) {
    console.error("Rapprochement des relevés impossible après suppression :", e);
  }

  revalidatePath("/factures");
  redirect("/factures");
}

/**
 * Force (ou retire) le classement « relevé de factures » d'un document, quand la
 * détection automatique s'est trompée. Relance le rapprochement.
 */
export async function setStatementFlag(id: string, isStatement: boolean): Promise<void> {
  const me = await requireUser();
  const inv = await prisma.invoice.findUnique({
    where: { id },
    select: {
      isStatement: true, status: true, totalHT: true, totalVAT: true, totalTTC: true,
      statementGrossHT: true, statementGrossVAT: true, statementGrossTTC: true,
    },
  });
  if (!inv || inv.isStatement === isStatement) return;
  // Un document validé ne doit plus changer de nature en un clic (voir setInvoiceStatus).
  if (inv.status === "validee") {
    redirect(`/factures/${id}?erreur=enregistrement`);
  }

  try {
    await prisma.$transaction([
      prisma.invoice.update({
        where: { id },
        data: isStatement
          ? {
              isStatement: true,
              // On mémorise les totaux actuels comme cumul du relevé si on n'en a pas.
              statementGrossHT: inv.statementGrossTTC == null ? inv.totalHT : undefined,
              statementGrossVAT: inv.statementGrossTTC == null ? inv.totalVAT : undefined,
              statementGrossTTC: inv.statementGrossTTC == null ? inv.totalTTC : undefined,
              coherence: "a_verifier",
            }
          : {
              isStatement: false,
              // On restaure le VRAI total du document (le cumul imprimé), pas le
              // reste-à-couvrir compensé qui a pu être ramené à 0 entre-temps :
              // sinon un relevé entièrement rapproché redeviendrait une facture à 0 €.
              totalHT: inv.statementGrossHT ?? inv.totalHT,
              totalVAT: inv.statementGrossVAT ?? inv.totalVAT,
              totalTTC: inv.statementGrossTTC ?? inv.totalTTC,
              statementGrossHT: null,
              statementGrossVAT: null,
              statementGrossTTC: null,
              coherence: "a_verifier",
              // Les notes de rapprochement (« Relevé rapproché à… ») n'ont plus lieu
              // d'être une fois reclassé en facture simple.
              notes: null,
            },
      }),
      ...(isStatement ? [] : [prisma.statementLine.deleteMany({ where: { statementId: id } })]),
      prisma.invoiceRevision.create({
        data: {
          invoiceId: id,
          field: "Type de document",
          oldValue: inv.isStatement ? "Relevé de factures" : "Facture",
          newValue: isStatement ? "Relevé de factures" : "Facture",
          userName: me.name,
        },
      }),
    ]);
    await reconcileStatements(prisma);
  } catch (e) {
    unstable_rethrow(e);
    console.error("Changement de type (relevé) impossible :", e);
    redirect(`/factures/${id}?erreur=enregistrement`);
  }

  revalidatePath(`/factures/${id}`);
  revalidatePath("/factures");
}

/**
 * Relance l'analyse automatique du document d'origine. Le travail (lecture / OCR)
 * est fait EN ARRIÈRE-PLAN pour ne pas bloquer l'écran ; les changements sont
 * journalisés. La fiche affiche « analyse en cours » puis se met à jour.
 */
export async function reanalyzeInvoice(id: string): Promise<void> {
  const me = await requireUser();
  try {
    const inv = await prisma.invoice.findUnique({
      where: { id },
      select: { originalFilePath: true, status: true },
    });
    if (!inv) redirect("/factures");
    if (!resolveUploadPath(inv.originalFilePath)) redirect(`/factures/${id}?analyse=nofile`);

    await prisma.invoice.update({ where: { id }, data: { status: "analyse_en_cours" } });
    enqueueAnalysis(id, "reanalyze", me.name);
    redirect(`/factures/${id}?analyse=lancee`);
  } catch (e) {
    unstable_rethrow(e);
    console.error("Ré-analyse impossible :", e);
    redirect(`/factures/${id}?analyse=erreur`);
  }
}
