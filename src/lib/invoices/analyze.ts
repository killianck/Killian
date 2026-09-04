// Analyse d'une facture déjà enregistrée (le fichier est sur disque, la ligne
// existe en base) : lecture du document -> extraction -> mise à jour de la ligne.
//
// Séparé de l'import pour pouvoir tourner EN ARRIÈRE-PLAN (file d'attente) : le
// dépôt de fichiers ne doit jamais bloquer l'utilisateur pendant l'OCR.

import { readFile } from "node:fs/promises";
import { prisma } from "@/lib/db";
import { resolveUploadPath } from "@/lib/paths";
import { getInvoiceParser } from "@/lib/parsing";
import { checkCoherence } from "@/lib/tva/coherence";
import { resolveParty } from "@/lib/invoices/party";
import { duplicateKey } from "@/lib/invoices/duplicates";
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

export type AnalyzeMode = "import" | "reanalyze";

/**
 * (Ré)analyse la facture `id` et met à jour sa ligne. Ne lève jamais : en cas
 * d'échec la facture passe au statut « erreur » avec une note explicative.
 * @param mode  "import" = 1re analyse (écrase tout) ; "reanalyze" = journalise les
 *              changements et ne remplace une valeur que si le parseur la trouve.
 * @param userName  auteur des lignes de journal (ré-analyse manuelle).
 */
export async function applyAnalysis(id: string, mode: AnalyzeMode, userName?: string): Promise<void> {
  const inv = await prisma.invoice.findUnique({ where: { id }, include: { vatLines: true } });
  if (!inv) return;

  const src = resolveUploadPath(inv.originalFilePath);
  let parsed: ParsedInvoice = STUB;
  try {
    if (!src) throw new Error("document introuvable");
    const buffer = await readFile(src);
    parsed = await getInvoiceParser().parse({
      fileBuffer: buffer,
      fileName: inv.originalFileName ?? "document",
      mimeType: mimeFor(inv.originalFileName),
    });
  } catch (e) {
    console.error(`Analyse de la facture ${id} impossible :`, e);
    await prisma.invoice
      .update({
        where: { id },
        data: {
          status: "erreur",
          coherence: "a_verifier",
          notes: "L'analyse automatique a échoué. Saisissez les informations via « Modifier ».",
        },
      })
      .catch(() => {});
    return;
  }

  const keepExisting = mode === "reanalyze";
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

  const coherence =
    parsed.amountsUncertain || !(totalHT || totalTTC)
      ? "a_verifier"
      : checkCoherence({
          totalHT, totalVAT, totalTTC, vatLines,
          documentType,
          invoiceDate: parsed.invoiceDate ?? undefined,
          dueDate: dueDate ? dueDate.toISOString().slice(0, 10) : undefined,
        }).level;

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
    status: parsed.confidence > 0 ? "a_verifier" : "a_analyser",
    coherence,
    confidence: parsed.confidence,
  };

  const revisions =
    mode === "reanalyze"
      ? diffInvoice(
          { ...inv, vatLines: inv.vatLines.map((l) => ({ rate: l.rate, baseHT: l.baseHT, vatAmount: l.vatAmount })) } as Record<string, unknown>,
          { ...inv, ...data, vatLines } as Record<string, unknown>,
        )
      : [];

  await prisma.$transaction([
    prisma.vatLine.deleteMany({ where: { invoiceId: id } }),
    prisma.invoice.update({
      where: { id },
      data: {
        ...data,
        notes: warnings.length ? warnings.join("\n") : keepExisting ? inv.notes : null,
        vatLines: vatLines.length ? { create: vatLines } : undefined,
      },
    }),
    ...(mode === "reanalyze"
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
}
