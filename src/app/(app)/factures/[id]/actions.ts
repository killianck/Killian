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

  revalidatePath("/factures");
  redirect("/factures");
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
