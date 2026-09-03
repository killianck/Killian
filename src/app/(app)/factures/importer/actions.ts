"use server";

import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { uploadDir } from "@/lib/paths";
import { getInvoiceParser } from "@/lib/parsing";
import { checkCoherence } from "@/lib/tva/coherence";
import { resolveParty } from "@/lib/invoices/party";
import { duplicateKey } from "@/lib/invoices/duplicates";
import { requireUser } from "@/lib/auth";

const MAX_SIZE = 20 * 1024 * 1024; // 20 Mo

const ACCEPTED = /\.(pdf|jpe?g|png|webp|tiff?|bmp|heic|heif)$/i;
const IMAGE_EXT = /\.(jpe?g|png|webp|tiff?|bmp|heic|heif)$/i;

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

/** Vérifie que les premiers octets correspondent bien au type annoncé. */
function contentLooksRight(buffer: Buffer, isImage: boolean): boolean {
  const head = buffer.subarray(0, 12);
  if (!isImage) return head.subarray(0, 5).toString("latin1") === "%PDF-";
  const hex = head.toString("hex");
  return (
    hex.startsWith("ffd8ff") || // jpeg
    hex.startsWith("89504e47") || // png
    head.subarray(0, 4).toString("latin1") === "RIFF" || // webp
    hex.startsWith("49492a00") || hex.startsWith("4d4d002a") || // tiff
    head.subarray(0, 2).toString("latin1") === "BM" || // bmp
    head.subarray(4, 12).toString("latin1").includes("ftyp") // heic
  );
}

async function importOne(
  file: File,
  direction: "achat" | "vente",
  documentType: "facture" | "avoir",
): Promise<ImportResult> {
  const name = file.name || "document";
  if (file.size === 0) {
    return { fileName: name, status: "error", message: "Fichier vide (0 octet) — non importé." };
  }
  if (!ACCEPTED.test(name)) {
    return {
      fileName: name,
      status: "error",
      message: "Format non pris en charge : déposez un PDF ou une photo (JPG, PNG…).",
    };
  }
  if (file.size > MAX_SIZE) {
    return { fileName: name, status: "error", message: "Fichier trop volumineux (max 20 Mo)." };
  }

  const isImage = IMAGE_EXT.test(name);
  const buffer = Buffer.from(await file.arrayBuffer());
  if (!contentLooksRight(buffer, isImage)) {
    return {
      fileName: name,
      status: "error",
      message: isImage ? "Cette image est illisible ou d'un format non reconnu." : "Ce fichier n'est pas un PDF valide.",
    };
  }

  const ext = isImage ? (name.match(IMAGE_EXT)?.[0].toLowerCase() ?? ".jpg") : ".pdf";
  const storedName = `${randomUUID()}${ext}`;
  let storedPath: string | null = null;

  try {
    const dir = uploadDir();
    await mkdir(dir, { recursive: true });
    storedPath = path.join(dir, storedName);
    await writeFile(storedPath, buffer);

    let parsed;
    try {
      parsed = await getInvoiceParser().parse({ fileBuffer: buffer, fileName: name, mimeType: file.type || undefined });
    } catch (e) {
      console.error("Analyse de la facture échouée :", e);
      parsed = {
        confidence: 0,
        engine: "stub",
        amountsUncertain: true,
        warnings: ["Impossible de lire automatiquement ce document. Veuillez saisir les informations manuellement."],
      };
    }

    const totalHT = parsed.totalHT ?? 0;
    const totalVAT = parsed.totalVAT ?? 0;
    const totalTTC = parsed.totalTTC ?? 0;
    const vatLines = parsed.vatLines ?? [];
    const finalDocType = parsed.documentType ?? documentType;
    const invoiceDate = parsed.invoiceDate ? new Date(parsed.invoiceDate) : new Date();

    // La cohérence n'est JAMAIS « coherent » si l'analyse est incertaine.
    let coherence: "coherent" | "a_verifier" | "incoherent";
    if (parsed.amountsUncertain || !(totalHT || totalTTC)) {
      coherence = "a_verifier";
    } else {
      coherence = checkCoherence({
        totalHT, totalVAT, totalTTC, vatLines,
        documentType: finalDocType,
        invoiceDate: parsed.invoiceDate,
        dueDate: parsed.dueDate,
      }).level;
    }

    const party = await resolveParty(prisma, {
      name: parsed.partyName ?? null,
      address: parsed.partyAddress ?? null,
      siret: parsed.siret ?? null,
      vatNumber: parsed.vatNumber ?? null,
      direction,
    });

    const warnings = [...parsed.warnings];
    if (!parsed.invoiceDate) {
      warnings.unshift("⚠️ Date de facture NON détectée : la date du jour a été mise par défaut, corrigez-la avant de valider.");
    }

    // Détection de doublon alignée sur src/lib/invoices/duplicates.ts (numéro
    // normalisé, ou tiers + date + TTC quand le numéro manque).
    const key = duplicateKey({
      id: "new",
      number: parsed.number ?? null,
      partyName: party.partyName,
      invoiceDate,
      totalTTC,
    });
    if (key) {
      const others = await prisma.invoice.findMany({
        select: { id: true, number: true, partyName: true, invoiceDate: true, totalTTC: true },
      });
      const dup = others.find(
        (o) => duplicateKey({ ...o, id: o.id }) === key,
      );
      if (dup) {
        warnings.unshift(
          "⚠️ Une facture très semblable existe déjà (même numéro/tiers ou même tiers, date et montant). Vérifiez qu'il ne s'agit pas d'un doublon.",
        );
      }
    }

    const created = await prisma.invoice.create({
      data: {
        documentType: finalDocType,
        direction,
        number: parsed.number ?? null,
        invoiceDate,
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
        confidence: parsed.confidence,
        notes: warnings.length ? warnings.join("\n") : null,
        originalFileName: name,
        originalFilePath: storedName, // chemin RELATIF (voir resolveUploadPath)
        vatLines: vatLines.length
          ? { create: vatLines.map((l) => ({ rate: l.rate, baseHT: l.baseHT, vatAmount: l.vatAmount })) }
          : undefined,
      },
    });

    const confPct = Math.round(parsed.confidence * 100);
    return {
      fileName: name,
      status: "ok",
      invoiceId: created.id,
      message: confPct > 0 ? `Analysée (confiance ${confPct} %) — à vérifier` : "Enregistrée — à compléter à la main",
    };
  } catch (e) {
    console.error("Import de la facture échoué :", e);
    if (storedPath) await unlink(storedPath).catch(() => {});
    return { fileName: name, status: "error", message: "Enregistrement impossible." };
  }
}

export async function importInvoices(_prev: ImportState, formData: FormData): Promise<ImportState> {
  await requireUser();
  const direction = formData.get("direction") === "vente" ? "vente" : "achat";
  const documentType = formData.get("documentType") === "avoir" ? "avoir" : "facture";

  const files = formData.getAll("file").filter((f): f is File => f instanceof File && f.name.length > 0);
  if (files.length === 0) {
    return { error: "Veuillez sélectionner au moins un fichier (PDF ou photo)." };
  }

  const results: ImportResult[] = [];
  for (const file of files) {
    results.push(await importOne(file, direction, documentType));
  }

  const ok = results.filter((r) => r.status === "ok");
  if (files.length === 1 && ok.length === 1) {
    redirect(`/factures/${ok[0].invoiceId}`);
  }

  return { results };
}
