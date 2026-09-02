"use server";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { uploadDir } from "@/lib/paths";
import { getInvoiceParser } from "@/lib/parsing";
import { checkCoherence } from "@/lib/tva/coherence";
import { resolveParty } from "@/lib/invoices/party";
import { requireUser } from "@/lib/auth";

const MAX_SIZE = 20 * 1024 * 1024; // 20 Mo

export type ImportResult = {
  fileName: string;
  status: "ok" | "error";
  invoiceId?: string;
  message?: string;
};

export type ImportState = {
  error?: string;
  results?: ImportResult[];
};

async function importOne(
  file: File,
  direction: "achat" | "vente",
  documentType: "facture" | "avoir",
): Promise<ImportResult> {
  if (file.type && file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return { fileName: file.name, status: "error", message: "Ce n'est pas un PDF." };
  }
  if (file.size > MAX_SIZE) {
    return { fileName: file.name, status: "error", message: "Fichier trop volumineux (max 20 Mo)." };
  }

  try {
    const dir = uploadDir();
    await mkdir(dir, { recursive: true });

    const buffer = Buffer.from(await file.arrayBuffer());
    const storedPath = path.join(dir, `${randomUUID()}.pdf`);
    await writeFile(storedPath, buffer);

    let parsed;
    try {
      parsed = await getInvoiceParser().parse({ fileBuffer: buffer, fileName: file.name });
    } catch (e) {
      console.error("Analyse de la facture échouée :", e);
      parsed = {
        confidence: 0,
        engine: "stub",
        warnings: [
          "Impossible de lire automatiquement cette facture. Veuillez saisir les informations manuellement.",
        ],
      };
    }

    const totalHT = parsed.totalHT ?? 0;
    const totalVAT = parsed.totalVAT ?? 0;
    const totalTTC = parsed.totalTTC ?? 0;
    const vatLines = parsed.vatLines ?? [];
    const coherence =
      totalHT || totalTTC ? checkCoherence({ totalHT, totalVAT, totalTTC, vatLines }).level : "a_verifier";

    const party = await resolveParty(prisma, {
      name: parsed.partyName ?? null,
      address: parsed.partyAddress ?? null,
      siret: parsed.siret ?? null,
      vatNumber: parsed.vatNumber ?? null,
      direction,
    });

    const warnings = [...parsed.warnings];
    if (parsed.number && party.partyName) {
      const dup = await prisma.invoice.findFirst({
        where: { number: parsed.number, partyName: party.partyName },
        select: { id: true },
      });
      if (dup) {
        warnings.unshift(
          "⚠️ Une facture portant le même numéro et le même tiers existe déjà. Vérifiez qu'il ne s'agit pas d'un doublon.",
        );
      }
    }

    const created = await prisma.invoice.create({
      data: {
        documentType: parsed.documentType ?? documentType,
        direction,
        number: parsed.number ?? null,
        invoiceDate: parsed.invoiceDate ? new Date(parsed.invoiceDate) : new Date(),
        dueDate: parsed.dueDate ? new Date(parsed.dueDate) : null,
        partyId: party.partyId,
        partyName: party.partyName,
        partyAddress: party.partyAddress,
        siret: party.siret,
        vatNumber: party.vatNumber,
        currency: parsed.currency ?? "EUR",
        totalHT,
        totalVAT,
        totalTTC,
        status: parsed.confidence > 0 ? "a_verifier" : "a_analyser",
        coherence,
        notes: warnings.length ? warnings.join(" ") : null,
        originalFileName: file.name,
        originalFilePath: storedPath,
        vatLines: vatLines.length
          ? { create: vatLines.map((l) => ({ rate: l.rate, baseHT: l.baseHT, vatAmount: l.vatAmount })) }
          : undefined,
      },
    });

    const confPct = Math.round(parsed.confidence * 100);
    return {
      fileName: file.name,
      status: "ok",
      invoiceId: created.id,
      message: confPct > 0 ? `Analysée (confiance ${confPct} %)` : "Enregistrée — à compléter à la main",
    };
  } catch (e) {
    console.error("Import de la facture échoué :", e);
    return { fileName: file.name, status: "error", message: "Enregistrement impossible." };
  }
}

export async function importInvoices(_prev: ImportState, formData: FormData): Promise<ImportState> {
  await requireUser();
  const direction = formData.get("direction") === "vente" ? "vente" : "achat";
  const documentType = formData.get("documentType") === "avoir" ? "avoir" : "facture";

  const files = formData.getAll("file").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) {
    return { error: "Veuillez sélectionner au moins un fichier PDF." };
  }

  const results: ImportResult[] = [];
  for (const file of files) {
    results.push(await importOne(file, direction, documentType));
  }

  // Un seul fichier importé avec succès -> on ouvre directement la facture.
  const ok = results.filter((r) => r.status === "ok");
  if (files.length === 1 && ok.length === 1) {
    redirect(`/factures/${ok[0].invoiceId}`);
  }

  return { results };
}
