"use server";

import { readFile } from "node:fs/promises";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { STATUSES, type Status } from "@/lib/domain/enums";
import { getInvoiceParser } from "@/lib/parsing";
import { checkCoherence } from "@/lib/tva/coherence";
import { totalsFromLines } from "@/lib/tva/lines";
import { diffInvoice } from "@/lib/domain/revisions";

/**
 * Change le statut d'une facture (validation manuelle, retour "à vérifier", etc.).
 * Trace le changement dans le journal des modifications.
 */
export async function setInvoiceStatus(id: string, status: Status): Promise<void> {
  if (!(status in STATUSES)) return;

  const current = await prisma.invoice.findUnique({ where: { id }, select: { status: true } });
  if (!current || current.status === status) return;

  await prisma.$transaction([
    prisma.invoice.update({ where: { id }, data: { status } }),
    prisma.invoiceRevision.create({
      data: {
        invoiceId: id,
        field: "Statut",
        oldValue: STATUSES[current.status as Status] ?? current.status,
        newValue: STATUSES[status],
      },
    }),
  ]);

  revalidatePath(`/factures/${id}`);
  revalidatePath("/factures");
}

/**
 * Relance l'analyse automatique du PDF d'origine et remplace les valeurs
 * actuelles par celles détectées. Chaque changement est journalisé.
 */
export async function reanalyzeInvoice(id: string): Promise<void> {
  const inv = await prisma.invoice.findUnique({ where: { id }, include: { vatLines: true } });
  if (!inv) redirect("/factures");
  if (!inv.originalFilePath) redirect(`/factures/${id}?analyse=nofile`);

  let buffer: Buffer;
  try {
    buffer = await readFile(inv.originalFilePath);
  } catch {
    redirect(`/factures/${id}?analyse=nofile`);
  }

  const parsed = await getInvoiceParser().parse({
    fileBuffer: buffer!,
    fileName: inv.originalFileName ?? "facture.pdf",
  });

  if (parsed.confidence === 0) {
    redirect(`/factures/${id}?analyse=vide`);
  }

  const lines =
    parsed.vatLines && parsed.vatLines.length
      ? parsed.vatLines.map((l) => ({ rate: l.rate, baseHT: l.baseHT, vatAmount: l.vatAmount }))
      : inv.vatLines.map((l) => ({ rate: l.rate, baseHT: l.baseHT, vatAmount: l.vatAmount }));

  const derived = totalsFromLines(lines);
  const totalHT = parsed.totalHT ?? (parsed.vatLines?.length ? derived.totalHT : inv.totalHT);
  const totalVAT = parsed.totalVAT ?? (parsed.vatLines?.length ? derived.totalVAT : inv.totalVAT);
  const totalTTC = parsed.totalTTC ?? (parsed.vatLines?.length ? derived.totalTTC : inv.totalTTC);

  const data = {
    documentType: parsed.documentType ?? inv.documentType,
    number: parsed.number ?? inv.number,
    invoiceDate: parsed.invoiceDate ? new Date(parsed.invoiceDate) : inv.invoiceDate,
    dueDate: parsed.dueDate ? new Date(parsed.dueDate) : inv.dueDate,
    partyName: parsed.partyName ?? inv.partyName,
    siret: parsed.siret ?? inv.siret,
    vatNumber: parsed.vatNumber ?? inv.vatNumber,
    currency: parsed.currency ?? inv.currency,
    totalHT,
    totalVAT,
    totalTTC,
  };

  const coherence = checkCoherence({ totalHT, totalVAT, totalTTC, vatLines: lines }).level;

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
        status: inv.status === "validee" ? "a_verifier" : inv.status === "a_analyser" ? "a_verifier" : inv.status,
        coherence,
        notes: parsed.warnings.length ? parsed.warnings.join(" ") : inv.notes,
        vatLines: { create: lines },
      },
    }),
    prisma.invoiceRevision.create({
      data: {
        invoiceId: id,
        field: "Analyse automatique",
        oldValue: `${inv.status}`,
        newValue: `relancée (confiance ${Math.round(parsed.confidence * 100)} %)`,
      },
    }),
    ...revisions.map((r) =>
      prisma.invoiceRevision.create({
        data: { invoiceId: id, field: r.field, oldValue: r.oldValue, newValue: r.newValue },
      }),
    ),
  ]);

  redirect(`/factures/${id}?analyse=ok`);
}
