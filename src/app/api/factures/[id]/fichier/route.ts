import { readFile } from "node:fs/promises";
import { prisma } from "@/lib/db";
import { resolveUploadPath } from "@/lib/paths";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/factures/:id/fichier -> renvoie le document original de la facture.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Non autorisé.", { status: 401 });

  try {
    const { id } = await params;
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      select: { originalFilePath: true, originalFileName: true },
    });

    if (!invoice?.originalFilePath) {
      return new Response("Aucun document original pour cette facture.", { status: 404 });
    }

    const filePath = resolveUploadPath(invoice.originalFilePath);
    if (!filePath) return new Response("Chemin de fichier invalide.", { status: 400 });

    const data = await readFile(filePath);
    const isPdf = /\.pdf$/i.test(filePath);
    // Nom de fichier assaini (anti-injection d'en-tête) + version UTF-8.
    const raw = invoice.originalFileName ?? (isPdf ? "facture.pdf" : "document");
    const safe = raw.replace(/[\r\n"\\\x00-\x1f]/g, "_");
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": isPdf ? "application/pdf" : "application/octet-stream",
        "Content-Disposition": `inline; filename="${safe}"; filename*=UTF-8''${encodeURIComponent(raw)}`,
      },
    });
  } catch (e) {
    console.error("Lecture du document original impossible :", e);
    return new Response("Le document original est introuvable ou inaccessible.", { status: 404 });
  }
}
