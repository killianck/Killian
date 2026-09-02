"use server";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { uploadDir } from "@/lib/paths";
import { getInvoiceParser } from "@/lib/parsing/stubParser";
import { checkCoherence } from "@/lib/tva/coherence";

const MAX_SIZE = 20 * 1024 * 1024; // 20 Mo

export type ImportState = { error?: string };

export async function importInvoice(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const file = formData.get("file");
  const direction = String(formData.get("direction") || "achat");
  const documentType = String(formData.get("documentType") || "facture");

  if (!(file instanceof File) || file.size === 0) {
    return { error: "Veuillez sélectionner un fichier PDF." };
  }
  if (file.type && file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return { error: "Le fichier doit être un PDF." };
  }
  if (file.size > MAX_SIZE) {
    return { error: "Le fichier est trop volumineux (maximum 20 Mo)." };
  }

  let newId: string;
  try {
    const dir = uploadDir();
    await mkdir(dir, { recursive: true });

    const buffer = Buffer.from(await file.arrayBuffer());
    const storedName = `${randomUUID()}.pdf`;
    const storedPath = path.join(dir, storedName);
    await writeFile(storedPath, buffer);

    // Analyse automatique (pour l'instant : "stub" -> ne remplit rien, prévient l'utilisateur)
    let parsed;
    try {
      parsed = await getInvoiceParser().parse({ fileBuffer: buffer, fileName: file.name });
    } catch (e) {
      console.error("Analyse de la facture échouée :", e);
      parsed = {
        confidence: 0,
        engine: "stub",
        warnings: [
          "Impossible de lire automatiquement cette facture. " +
            "Veuillez vérifier ou saisir les informations manuellement.",
        ],
      };
    }

    const totalHT = parsed.totalHT ?? 0;
    const totalVAT = parsed.totalVAT ?? 0;
    const totalTTC = parsed.totalTTC ?? 0;
    const vatLines = parsed.vatLines ?? [];
    const coherence =
      totalHT || totalTTC ? checkCoherence({ totalHT, totalVAT, totalTTC, vatLines }).level : "a_verifier";

    const created = await prisma.invoice.create({
      data: {
        documentType: parsed.documentType ?? (documentType === "avoir" ? "avoir" : "facture"),
        direction: direction === "vente" ? "vente" : "achat",
        number: parsed.number ?? null,
        invoiceDate: parsed.invoiceDate ? new Date(parsed.invoiceDate) : new Date(),
        dueDate: parsed.dueDate ? new Date(parsed.dueDate) : null,
        partyName: parsed.partyName ?? null,
        partyAddress: parsed.partyAddress ?? null,
        siret: parsed.siret ?? null,
        vatNumber: parsed.vatNumber ?? null,
        currency: parsed.currency ?? "EUR",
        totalHT,
        totalVAT,
        totalTTC,
        status: parsed.confidence > 0 ? "a_verifier" : "a_analyser",
        coherence,
        notes: parsed.warnings.length ? parsed.warnings.join(" ") : null,
        originalFileName: file.name,
        originalFilePath: storedPath,
        vatLines: vatLines.length
          ? { create: vatLines.map((l) => ({ rate: l.rate, baseHT: l.baseHT, vatAmount: l.vatAmount })) }
          : undefined,
      },
    });
    newId = created.id;
  } catch (e) {
    console.error("Import de la facture échoué :", e);
    return { error: "L'import a échoué. Le fichier n'a pas pu être enregistré. Réessayez." };
  }

  redirect(`/factures/${newId}`);
}
