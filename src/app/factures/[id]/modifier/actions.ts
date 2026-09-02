"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { parseAmount } from "@/lib/format";
import { checkCoherence } from "@/lib/tva/coherence";
import { totalsFromLines } from "@/lib/tva/lines";
import { diffInvoice } from "@/lib/domain/revisions";

export type EditState = { error?: string };

type RawLine = { rate: unknown; baseHT: unknown; vatAmount: unknown };

function str(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}
function orNull(v: string): string | null {
  return v === "" ? null : v;
}
function parseDate(v: string): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function updateInvoice(
  id: string,
  _prev: EditState,
  formData: FormData,
): Promise<EditState> {
  const existing = await prisma.invoice.findUnique({
    where: { id },
    include: { vatLines: true },
  });
  if (!existing) return { error: "Facture introuvable." };

  // --- Lignes de TVA ---
  let lines: { rate: number; baseHT: number; vatAmount: number }[] = [];
  try {
    const raw = JSON.parse(str(formData, "vatLinesJson") || "[]") as RawLine[];
    lines = raw
      .map((l) => ({
        rate: parseAmount(l.rate as string),
        baseHT: parseAmount(l.baseHT as string),
        vatAmount: parseAmount(l.vatAmount as string),
      }))
      .filter((l) => l.baseHT !== 0 || l.vatAmount !== 0 || l.rate !== 0);
  } catch {
    return { error: "Les lignes de TVA sont mal formées." };
  }

  // --- Totaux : saisis, ou déduits des lignes si vides ---
  const fromLines = totalsFromLines(lines);
  const hasManualTotals =
    str(formData, "totalHT") !== "" ||
    str(formData, "totalVAT") !== "" ||
    str(formData, "totalTTC") !== "";
  const totalHT = hasManualTotals ? parseAmount(str(formData, "totalHT")) : fromLines.totalHT;
  const totalVAT = hasManualTotals ? parseAmount(str(formData, "totalVAT")) : fromLines.totalVAT;
  const totalTTC = hasManualTotals
    ? parseAmount(str(formData, "totalTTC")) || Math.round((totalHT + totalVAT) * 100) / 100
    : fromLines.totalTTC;

  const documentType = str(formData, "documentType") === "avoir" ? "avoir" : "facture";
  const direction = str(formData, "direction") === "vente" ? "vente" : "achat";

  const data = {
    documentType,
    direction,
    category: orNull(str(formData, "category")),
    number: orNull(str(formData, "number")),
    invoiceDate: parseDate(str(formData, "invoiceDate")) ?? existing.invoiceDate,
    dueDate: parseDate(str(formData, "dueDate")),
    partyName: orNull(str(formData, "partyName")),
    partyAddress: orNull(str(formData, "partyAddress")),
    siret: orNull(str(formData, "siret")),
    vatNumber: orNull(str(formData, "vatNumber")),
    currency: orNull(str(formData, "currency")) ?? "EUR",
    notes: orNull(str(formData, "notes")),
    totalHT,
    totalVAT,
    totalTTC,
  };

  if (!parseDate(str(formData, "invoiceDate"))) {
    return { error: "La date de facture est obligatoire." };
  }

  const coherence = checkCoherence({ totalHT, totalVAT, totalTTC, vatLines: lines }).level;

  // --- Journal des modifications ---
  const before = {
    ...existing,
    vatLines: existing.vatLines.map((l) => ({ rate: l.rate, baseHT: l.baseHT, vatAmount: l.vatAmount })),
  };
  const after = { ...data, vatLines: lines };
  const revisions = diffInvoice(before as Record<string, unknown>, after as Record<string, unknown>);

  // Une facture "à analyser" qui est corrigée passe "à vérifier".
  // Une facture "validée" que l'on modifie repasse "à vérifier".
  const nextStatus =
    existing.status === "a_analyser" || existing.status === "analyse_en_cours" || existing.status === "validee"
      ? "a_verifier"
      : existing.status;

  try {
    await prisma.$transaction([
      prisma.vatLine.deleteMany({ where: { invoiceId: id } }),
      prisma.invoice.update({
        where: { id },
        data: {
          ...data,
          status: nextStatus,
          coherence,
          vatLines: { create: lines.map((l) => ({ rate: l.rate, baseHT: l.baseHT, vatAmount: l.vatAmount })) },
        },
      }),
      ...revisions.map((r) =>
        prisma.invoiceRevision.create({
          data: { invoiceId: id, field: r.field, oldValue: r.oldValue, newValue: r.newValue },
        }),
      ),
    ]);
  } catch (e) {
    console.error("Échec de l'enregistrement de la facture :", e);
    return { error: "L'enregistrement a échoué. Vérifiez les valeurs saisies et réessayez." };
  }

  redirect(`/factures/${id}`);
}
