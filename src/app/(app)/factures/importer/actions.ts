"use server";

import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { uploadDir } from "@/lib/paths";
import { enqueueAnalysis } from "@/lib/invoices/analysisQueue";
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

/**
 * Enregistre UN fichier et crée la facture au statut « analyse en cours ».
 * L'analyse (lecture / OCR) est faite ENSUITE, en arrière-plan : le dépôt de
 * fichiers reste instantané même pour un lot de scans.
 */
async function saveOne(
  file: File,
  direction: "achat" | "vente",
  documentType: "facture" | "avoir",
): Promise<ImportResult> {
  const name = file.name || "document";
  if (file.size === 0) {
    return { fileName: name, status: "error", message: "Fichier vide (0 octet) — non importé." };
  }
  if (!ACCEPTED.test(name)) {
    return { fileName: name, status: "error", message: "Format non pris en charge : déposez un PDF ou une photo (JPG, PNG…)." };
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

    const created = await prisma.invoice.create({
      data: {
        documentType,
        direction,
        invoiceDate: new Date(), // provisoire — corrigé par l'analyse
        currency: "EUR",
        status: "analyse_en_cours",
        coherence: "a_verifier",
        notes: "Analyse automatique en cours…",
        originalFileName: name,
        originalFilePath: storedName, // relatif (voir resolveUploadPath)
      },
    });

    enqueueAnalysis(created.id, "import");
    return { fileName: name, status: "ok", invoiceId: created.id, message: "Importé — analyse en cours" };
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
    results.push(await saveOne(file, direction, documentType));
  }

  const ok = results.filter((r) => r.status === "ok");
  if (files.length === 1 && ok.length === 1) {
    redirect(`/factures/${ok[0].invoiceId}`);
  }

  return { results };
}
