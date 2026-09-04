// Reconnaissance de texte (OCR) pour les factures « scannées » : PDF image
// (sans texte) et photos (JPG / PNG / …).
//
//   1. pour un PDF : mupdf transforme chaque page en image (gère la compression
//      JBIG2 des scanners, contrairement à pdf.js) ;
//   2. tesseract.js lit l'image et en extrait le texte, en français.
//
// C'est plus lent (quelques secondes par page) et moins fiable qu'un vrai texte :
// le résultat DOIT toujours être vérifié par l'utilisateur. On remonte l'indice
// de confiance de Tesseract pour pouvoir déclasser une lecture douteuse.

import path from "node:path";
import { existsSync } from "node:fs";

/** Pages OCRisées au maximum. Au-delà, on lit aussi les 2 dernières (totaux). */
const MAX_PAGES = 8;
/** Cible ~2400 px sur le grand côté (≈ 300 dpi pour une page A4). */
const TARGET_LONG_SIDE_PX = 2400;
const MIN_SCALE = 2;
const MAX_SCALE = 4.5;
/** Délais de sécurité : un PDF pathologique ne doit jamais bloquer l'import. */
const PER_PAGE_TIMEOUT_MS = 45_000;
const GLOBAL_TIMEOUT_MS = 180_000;

export type OcrResult = {
  text: string;
  /** Confiance moyenne de Tesseract sur les pages lues (0–100), ou undefined. */
  meanConfidence?: number;
  warnings: string[];
};

/** Dossier contenant `fra.traineddata.gz` (données de langue de Tesseract). */
function bundledTessdataDir(): string | undefined {
  const candidates = [
    process.env.TESSDATA_DIR,
    path.join(process.cwd(), "tessdata"),
    path.join(process.cwd(), "src", "lib", "parsing", "tessdata"),
    path.join(__dirname, "tessdata"),
    path.join(__dirname, "..", "..", "..", "src", "lib", "parsing", "tessdata"),
  ].filter((d): d is string => Boolean(d));
  return candidates.find((dir) => existsSync(path.join(dir, "fra.traineddata.gz")));
}

function withTimeout<T>(p: Promise<T>, ms: number, onTimeout: () => void): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => {
      onTimeout();
      reject(new Error("délai dépassé"));
    }, ms);
    p.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); },
    );
  });
}

/** Indices de page à rendre : les MAX_PAGES premières + les 2 dernières. */
function pageIndices(count: number): { indices: number[]; truncated: boolean } {
  if (count <= MAX_PAGES) return { indices: [...Array(count).keys()], truncated: false };
  const first = [...Array(MAX_PAGES).keys()];
  const last = [count - 2, count - 1].filter((i) => i >= MAX_PAGES);
  return { indices: [...first, ...last], truncated: true };
}

/** Transforme les pages utiles du PDF en images PNG (niveaux de gris). */
async function renderPdfPages(buffer: Buffer): Promise<{ images: Uint8Array[]; warnings: string[] }> {
  const mupdf = await import("mupdf");
  const warnings: string[] = [];
  let doc: import("mupdf").Document;
  try {
    doc = mupdf.Document.openDocument(new Uint8Array(buffer), "application/pdf");
  } catch {
    return { images: [], warnings: ["Le PDF n'a pas pu être ouvert (fichier corrompu ou protégé)."] };
  }
  try {
    const total = doc.countPages();
    if (total > 30) {
      return {
        images: [],
        warnings: [
          `Ce document fait ${total} pages : c'est trop long pour être une facture. ` +
            "L'analyse automatique a été ignorée — saisissez les informations à la main si besoin.",
        ],
      };
    }
    const { indices, truncated } = pageIndices(total);
    if (truncated) {
      warnings.push(
        `Document de ${total} pages : seules les premières et les 2 dernières ont été analysées ` +
          `automatiquement — vérifiez que les totaux lus correspondent bien à la dernière page.`,
      );
    }
    const images: Uint8Array[] = [];
    for (const i of indices) {
      let page: import("mupdf").PDFPage | import("mupdf").Page | undefined;
      let pixmap: import("mupdf").Pixmap | undefined;
      try {
        page = doc.loadPage(i);
        const [x0, y0, x1, y1] = page.getBounds();
        const longSide = Math.max(x1 - x0, y1 - y0) || 595;
        const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, TARGET_LONG_SIDE_PX / longSide));
        pixmap = page.toPixmap(mupdf.Matrix.scale(scale, scale), mupdf.ColorSpace.DeviceGray, false, true);
        images.push(pixmap.asPNG());
      } catch {
        warnings.push(`La page ${i + 1} n'a pas pu être convertie en image et a été ignorée.`);
      } finally {
        try { pixmap?.destroy(); } catch { /* ignore */ }
        try { page?.destroy(); } catch { /* ignore */ }
      }
    }
    return { images, warnings };
  } finally {
    try { doc.destroy(); } catch { /* ignore */ }
  }
}

async function recognizeImages(images: Uint8Array[]): Promise<OcrResult> {
  if (!images.length) return { text: "", warnings: [] };

  const { createWorker } = await import("tesseract.js");
  const langPath = bundledTessdataDir();
  if (!langPath) {
    return {
      text: "",
      warnings: [
        "Reconnaissance de texte indisponible : les données de langue ne sont pas installées. " +
          "Saisissez les informations manuellement.",
      ],
    };
  }

  const worker = await createWorker("fra", 1, { langPath, cacheMethod: "none", gzip: true });
  const warnings: string[] = [];
  const pages: string[] = [];
  const confidences: number[] = [];
  const started = Date.now();

  try {
    for (const image of images) {
      if (Date.now() - started > GLOBAL_TIMEOUT_MS) {
        warnings.push("Analyse automatique interrompue (document trop lourd) — vérifiez ou saisissez à la main.");
        break;
      }
      try {
        const { data } = await withTimeout(
          worker.recognize(Buffer.from(image)),
          PER_PAGE_TIMEOUT_MS,
          () => { void worker.terminate().catch(() => {}); },
        );
        if (data.text?.trim()) pages.push(data.text);
        if (typeof data.confidence === "number" && data.confidence > 0) confidences.push(data.confidence);
      } catch {
        warnings.push("Une page n'a pas pu être lue par la reconnaissance de texte.");
        break; // le worker peut avoir été terminé par le timeout
      }
    }
  } finally {
    try { await worker.terminate(); } catch { /* déjà terminé */ }
  }

  const meanConfidence = confidences.length
    ? Math.round(confidences.reduce((s, c) => s + c, 0) / confidences.length)
    : undefined;
  if (meanConfidence !== undefined && meanConfidence < 65) {
    warnings.push(
      `Lecture OCR peu fiable (qualité ${meanConfidence} %) : relisez très attentivement chaque montant, ` +
        `ou ressaisissez-les.`,
    );
  }
  return { text: pages.join("\n\n"), meanConfidence, warnings };
}

/** OCR d'un PDF scanné. */
export async function ocrPdf(buffer: Buffer): Promise<OcrResult> {
  const { images, warnings } = await renderPdfPages(buffer);
  const res = await recognizeImages(images);
  return { ...res, warnings: [...warnings, ...res.warnings] };
}

/** OCR d'une image (photo de facture, capture d'écran…). */
export async function ocrImage(buffer: Buffer): Promise<OcrResult> {
  return recognizeImages([new Uint8Array(buffer)]);
}
