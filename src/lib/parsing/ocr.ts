// Reconnaissance de texte (OCR) pour les PDF « scannés » (image, sans texte).
//
// Beaucoup de factures fournisseurs sont des scans : le PDF ne contient qu'une
// image, aucun texte sélectionnable. On reconstruit alors le texte en deux temps :
//   1. mupdf transforme chaque page en image PNG (gère la compression JBIG2 des
//      scanners, contrairement à pdf.js) ;
//   2. tesseract.js lit cette image et en extrait le texte, en français.
//
// C'est plus lent (quelques secondes par page) et moins fiable qu'un vrai texte :
// le résultat DOIT toujours être vérifié par l'utilisateur.

import path from "node:path";
import { existsSync } from "node:fs";

/** Nombre de pages OCRisées au maximum (les totaux d'une facture tiennent sur peu de pages). */
const MAX_PAGES = 8;
/** Facteur d'agrandissement avant OCR : 3 = ~216 dpi, bon compromis netteté / vitesse. */
const RENDER_SCALE = 3;

/**
 * Dossier contenant `fra.traineddata.gz` (données de langue de Tesseract),
 * embarqué avec l'application pour fonctionner hors ligne. En développement,
 * s'il est absent, tesseract.js le télécharge et le met en cache tout seul.
 */
function bundledTessdataDir(): string | undefined {
  const candidates = [
    path.join(process.cwd(), "src", "lib", "parsing", "tessdata"),
    path.join(process.cwd(), "tessdata"),
    path.join(__dirname, "tessdata"),
    path.join(__dirname, "..", "..", "..", "src", "lib", "parsing", "tessdata"),
  ];
  return candidates.find((dir) => existsSync(path.join(dir, "fra.traineddata.gz")));
}

/** Transforme chaque page du PDF en image PNG via mupdf. */
async function renderPdfPages(buffer: Buffer): Promise<Uint8Array[]> {
  const mupdf = await import("mupdf");
  const doc = mupdf.Document.openDocument(new Uint8Array(buffer), "application/pdf");
  try {
    const pageCount = Math.min(doc.countPages(), MAX_PAGES);
    const images: Uint8Array[] = [];
    const matrix = mupdf.Matrix.scale(RENDER_SCALE, RENDER_SCALE);
    for (let i = 0; i < pageCount; i++) {
      const page = doc.loadPage(i);
      const pixmap = page.toPixmap(matrix, mupdf.ColorSpace.DeviceRGB, false, true);
      images.push(pixmap.asPNG());
      pixmap.destroy();
      page.destroy();
    }
    return images;
  } finally {
    doc.destroy();
  }
}

/**
 * Extrait le texte d'un PDF scanné par OCR.
 * Renvoie "" si le PDF ne peut pas être rendu en image.
 */
export async function ocrPdf(buffer: Buffer): Promise<string> {
  const images = await renderPdfPages(buffer);
  if (!images.length) return "";

  const { createWorker } = await import("tesseract.js");
  const langPath = bundledTessdataDir();
  const worker = await createWorker(
    "fra",
    1,
    langPath ? { langPath, cacheMethod: "none", gzip: true } : undefined,
  );

  try {
    const pages: string[] = [];
    for (const image of images) {
      const { data } = await worker.recognize(Buffer.from(image));
      if (data.text?.trim()) pages.push(data.text);
    }
    return pages.join("\n\n");
  } finally {
    await worker.terminate();
  }
}
