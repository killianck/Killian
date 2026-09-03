"use server";

import { mkdir, readFile, rename } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { prisma } from "@/lib/db";
import { dataDir, resolveUploadPath } from "@/lib/paths";
import { STATUSES, type Status } from "@/lib/domain/enums";
import { getInvoiceParser } from "@/lib/parsing";
import { checkCoherence } from "@/lib/tva/coherence";
import { totalsFromLines } from "@/lib/tva/lines";
import { diffInvoice } from "@/lib/domain/revisions";
import { resolveParty } from "@/lib/invoices/party";
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

/** Règle de transition de statut partagée avec la modification manuelle. */
function statusAfterEdit(current: string): string {
  return current === "validee" || current === "a_analyser" || current === "analyse_en_cours" || current === "erreur"
    ? "a_verifier"
    : current;
}

/**
 * Relance l'analyse automatique du document d'origine et remplace les valeurs
 * actuelles par celles détectées. Chaque changement est journalisé.
 */
export async function reanalyzeInvoice(id: string): Promise<void> {
  const me = await requireUser();
  try {
    const inv = await prisma.invoice.findUnique({ where: { id }, include: { vatLines: true } });
    if (!inv) redirect("/factures");
    const src = resolveUploadPath(inv.originalFilePath);
    if (!src) redirect(`/factures/${id}?analyse=nofile`);

    let buffer: Buffer;
    try {
      buffer = await readFile(src);
    } catch {
      redirect(`/factures/${id}?analyse=nofile`);
      return;
    }

    const parsed = await getInvoiceParser().parse({
      fileBuffer: buffer,
      fileName: inv.originalFileName ?? "facture.pdf",
    });

    if (parsed.confidence === 0) redirect(`/factures/${id}?analyse=vide`);

    const parsedLines = parsed.vatLines?.length
      ? parsed.vatLines.map((l) => ({ rate: l.rate, baseHT: l.baseHT, vatAmount: l.vatAmount }))
      : null;
    const lines = parsedLines ?? inv.vatLines.map((l) => ({ rate: l.rate, baseHT: l.baseHT, vatAmount: l.vatAmount }));

    // Les 3 totaux forment un bloc : soit ils viennent du parseur, soit des
    // lignes, soit de l'existant — jamais un mélange incohérent.
    const derived = totalsFromLines(lines);
    let totalHT: number, totalVAT: number, totalTTC: number;
    if (parsed.totalHT !== undefined || parsed.totalVAT !== undefined || parsed.totalTTC !== undefined) {
      totalHT = parsed.totalHT ?? derived.totalHT;
      totalVAT = parsed.totalVAT ?? derived.totalVAT;
      totalTTC = parsed.totalTTC ?? derived.totalTTC;
    } else if (parsedLines) {
      ({ totalHT, totalVAT, totalTTC } = derived);
    } else {
      totalHT = inv.totalHT;
      totalVAT = inv.totalVAT;
      totalTTC = inv.totalTTC;
    }

    const party = await resolveParty(prisma, {
      name: parsed.partyName ?? inv.partyName,
      address: inv.partyAddress,
      siret: parsed.siret ?? inv.siret,
      vatNumber: parsed.vatNumber ?? inv.vatNumber,
      direction: inv.direction,
    });

    const data = {
      documentType: parsed.documentType ?? inv.documentType,
      number: parsed.number ?? inv.number,
      invoiceDate: parsed.invoiceDate ? new Date(parsed.invoiceDate) : inv.invoiceDate,
      dueDate: parsed.dueDate ? new Date(parsed.dueDate) : inv.dueDate,
      partyId: party.partyId,
      partyName: party.partyName,
      partyAddress: party.partyAddress,
      siret: party.siret,
      vatNumber: party.vatNumber,
      currency: parsed.currency ?? inv.currency,
      totalHT,
      totalVAT,
      totalTTC,
    };

    const coherence =
      parsed.amountsUncertain || !(totalHT || totalTTC)
        ? "a_verifier"
        : checkCoherence({
            totalHT, totalVAT, totalTTC, vatLines: lines,
            documentType: data.documentType as "facture" | "avoir",
            invoiceDate: parsed.invoiceDate,
            dueDate: isoDay(data.dueDate),
          }).level;

    const before = {
      ...inv,
      vatLines: inv.vatLines.map((l) => ({ rate: l.rate, baseHT: l.baseHT, vatAmount: l.vatAmount })),
    };
    const revisions = diffInvoice(
      before as Record<string, unknown>,
      { ...before, ...data, vatLines: lines } as Record<string, unknown>,
    );

    await prisma.$transaction([
      prisma.vatLine.deleteMany({ where: { invoiceId: id } }),
      prisma.invoice.update({
        where: { id },
        data: {
          ...data,
          status: statusAfterEdit(inv.status),
          coherence,
          notes: parsed.warnings.length ? parsed.warnings.join("\n") : inv.notes,
          vatLines: { create: lines },
        },
      }),
      prisma.invoiceRevision.create({
        data: {
          invoiceId: id,
          field: "Analyse automatique",
          oldValue: inv.status,
          newValue: `relancée (confiance ${Math.round(parsed.confidence * 100)} %)`,
          userName: me.name,
        },
      }),
      ...revisions.map((r) =>
        prisma.invoiceRevision.create({
          data: { invoiceId: id, field: r.field, oldValue: r.oldValue, newValue: r.newValue, userName: me.name },
        }),
      ),
    ]);

    redirect(`/factures/${id}?analyse=ok`);
  } catch (e) {
    unstable_rethrow(e);
    console.error("Ré-analyse échouée :", e);
    redirect(`/factures/${id}?analyse=erreur`);
  }
}
