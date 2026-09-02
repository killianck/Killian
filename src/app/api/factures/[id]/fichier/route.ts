import { readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/db";
import { uploadDir } from "@/lib/paths";

export const dynamic = "force-dynamic";

// GET /api/factures/:id/fichier -> renvoie le PDF original de la facture.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    select: { originalFilePath: true, originalFileName: true },
  });

  if (!invoice?.originalFilePath) {
    return new Response("Aucun document original pour cette facture.", { status: 404 });
  }

  // Sécurité : le fichier doit rester dans le dossier d'upload.
  const dir = path.resolve(uploadDir());
  const filePath = path.resolve(invoice.originalFilePath);
  if (!filePath.startsWith(dir + path.sep)) {
    return new Response("Chemin de fichier invalide.", { status: 400 });
  }

  try {
    const data = await readFile(filePath);
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${invoice.originalFileName ?? "facture.pdf"}"`,
      },
    });
  } catch {
    return new Response("Le fichier original est introuvable sur le disque.", { status: 404 });
  }
}
