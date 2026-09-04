// Reconnaissance de texte (OCR) pour les factures « scannées » : PDF image
// (sans texte) et photos (JPG / PNG / …).
//
//   1. pour un PDF : mupdf transforme chaque page en image (gère la compression
//      JBIG2 des scanners, contrairement à pdf.js) ;
//   2. tesseract.js lit l'image et en extrait le texte, en français.
//
// Rapidité : les workers Tesseract sont PERSISTANTS (src/lib/parsing/ocrWorker.ts),
// on ne demande que le texte (pas de hOCR / TSV), et on rend les pages à une
// résolution juste suffisante pour du texte imprimé.
// Le résultat DOIT toujours être vérifié par l'utilisateur : on remonte l'indice
// de confiance de Tesseract pour déclasser une lecture douteuse.

import { withOcrWorker } from "./ocrWorker";

/** Pages OCRisées au maximum. Au-delà, on lit aussi les 2 dernières (totaux). */
const MAX_PAGES = 8;
/** ~2200 px sur le grand côté ≈ 275 dpi pour une page A4 : net pour du texte imprimé. */
const TARGET_LONG_SIDE_PX = 2200;
const MIN_SCALE = 1.8;
const MAX_SCALE = 4;
/** Délais de sécurité : un document pathologique ne doit jamais bloquer l'analyse. */
const PER_PAGE_TIMEOUT_MS = 40_000;
const GLOBAL_TIMEOUT_MS = 150_000;
/** Ne garder que le texte : construire hOCR / TSV / blocs coûte 15–30 % de temps. */
const OUTPUT = { text: true, blocks: false, hocr: false, tsv: false, box: false, unlv: false, osd: false } as const;

export type OcrResult = {
  text: string;
  /** Confiance moyenne de Tesseract sur les pages lues (0–100), ou undefined. */
  meanConfidence?: number;
  warnings: string[];
};

type RenderedPage = { png: Buffer; dpi: number };

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("délai OCR dépassé")), ms);
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
async function renderPdfPages(buffer: Buffer): Promise<{ pages: RenderedPage[]; warnings: string[] }> {
  const mupdf = await import("mupdf");
  const warnings: string[] = [];
  let doc: import("mupdf").Document;
  try {
    doc = mupdf.Document.openDocument(new Uint8Array(buffer), "application/pdf");
  } catch {
    return { pages: [], warnings: ["Le PDF n'a pas pu être ouvert (fichier corrompu ou protégé)."] };
  }
  try {
    const total = doc.countPages();
    if (total > 30) {
      return {
        pages: [],
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
    const pages: RenderedPage[] = [];
    for (const i of indices) {
      let page: import("mupdf").PDFPage | import("mupdf").Page | undefined;
      let pixmap: import("mupdf").Pixmap | undefined;
      try {
        page = doc.loadPage(i);
        const [x0, y0, x1, y1] = page.getBounds();
        const longSidePts = Math.max(x1 - x0, y1 - y0) || 595;
        const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, TARGET_LONG_SIDE_PX / longSidePts));
        pixmap = page.toPixmap(mupdf.Matrix.scale(scale, scale), mupdf.ColorSpace.DeviceGray, false, true);
        pages.push({ png: Buffer.from(pixmap.asPNG()), dpi: Math.round(scale * 72) });
      } catch {
        warnings.push(`La page ${i + 1} n'a pas pu être convertie en image et a été ignorée.`);
      } finally {
        try { pixmap?.destroy(); } catch { /* ignore */ }
        try { page?.destroy(); } catch { /* ignore */ }
      }
    }
    return { pages, warnings };
  } finally {
    try { doc.destroy(); } catch { /* ignore */ }
  }
}

async function recognizePages(pages: RenderedPage[]): Promise<OcrResult> {
  if (!pages.length) return { text: "", warnings: [] };

  const warnings: string[] = [];
  const texts: string[] = [];
  const confidences: number[] = [];
  const started = Date.now();

  const out = await withOcrWorker(async (w) => {
    for (const page of pages) {
      if (Date.now() - started > GLOBAL_TIMEOUT_MS) {
        warnings.push("Analyse automatique interrompue (document trop lourd) — vérifiez ou saisissez à la main.");
        break;
      }
      try {
        await w.setParameters({ user_defined_dpi: String(page.dpi) });
        const { data } = await withTimeout(w.recognize(page.png, {}, OUTPUT), PER_PAGE_TIMEOUT_MS);
        if (data.text?.trim()) texts.push(data.text);
        if (typeof data.confidence === "number" && data.confidence > 0) confidences.push(data.confidence);
      } catch {
        warnings.push("Une page n'a pas pu être lue par la reconnaissance de texte (délai dépassé ?).");
        throw new Error("page-failed"); // fait recycler le worker
      }
    }
    return true;
  }).catch(() => false);

  if (out === null) {
    return {
      text: "",
      warnings: [
        "Reconnaissance de texte indisponible : données de langue non installées. Saisissez les informations manuellement.",
      ],
    };
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
  return { text: texts.join("\n\n"), meanConfidence, warnings };
}

/** OCR d'un PDF scanné. */
export async function ocrPdf(buffer: Buffer): Promise<OcrResult> {
  const { pages, warnings } = await renderPdfPages(buffer);
  const res = await recognizePages(pages);
  return { ...res, warnings: [...warnings, ...res.warnings] };
}

/** OCR d'une image (photo de facture, capture d'écran…). */
export async function ocrImage(buffer: Buffer): Promise<OcrResult> {
  return recognizePages([{ png: Buffer.from(buffer), dpi: 150 }]);
}
