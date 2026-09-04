// Analyseur "heuristique" : lit le TEXTE du document et repère les informations
// courantes d'une facture française (montants, dates, numéro, TVA...).
//
// Ce n'est pas de l'IA : c'est un ensemble de règles. Le résultat doit toujours
// être vérifié par l'utilisateur.
//
// Sources de texte, dans l'ordre :
//   1. le texte intégré au PDF (rapide, fiable) ;
//   2. si le PDF est un scan (peu de texte) ou une PHOTO : la reconnaissance de
//      caractères (OCR) reconstruit le texte à partir de l'image.

import type { InvoiceParser, ParsedInvoice, ParseInput } from "./types";
import { extractPdfText } from "./pdfText";
import { buildParsedInvoice } from "./extract";
import { ocrPdf, ocrImage, type OcrResult } from "./ocr";

const IMAGE_MIME = /^image\//i;
const IMAGE_EXT = /\.(jpe?g|png|webp|tiff?|bmp|heic|heif)$/i;

function isImage(input: ParseInput): boolean {
  return IMAGE_MIME.test(input.mimeType ?? "") || IMAGE_EXT.test(input.fileName);
}

export class HeuristicParser implements InvoiceParser {
  readonly name = "heuristic";

  async parse(input: ParseInput): Promise<ParsedInvoice> {
    // --- Photo : directement en OCR ---
    if (isImage(input)) {
      let ocr: OcrResult = { text: "", warnings: [] };
      try {
        ocr = await ocrImage(input.fileBuffer);
      } catch (e) {
        console.error("OCR de l'image impossible :", e);
      }
      const result = buildParsedInvoice(ocr.text, "photo + OCR");
      result.warnings.unshift(
        "Photo de facture : le texte a été reconstruit automatiquement (OCR). " +
          "Vérifiez attentivement chaque montant, la date et le numéro.",
      );
      result.warnings.push(...ocr.warnings);
      return this.degradeIfNoisyOcr(result, ocr.meanConfidence);
    }

    // --- PDF : texte intégré d'abord ---
    let text = "";
    try {
      text = await extractPdfText(input.fileBuffer);
    } catch (e) {
      console.error("Lecture du texte du PDF impossible :", e);
    }

    let result = buildParsedInvoice(text, this.name);

    // On tente l'OCR seulement si l'analyse du texte natif est vraiment
    // insuffisante : pas de TTC, OU confiance basse et peu de texte lisible.
    // (L'OCR est coûteux — on ne le lance pas « au cas où ».)
    const nonBlank = text.replace(/\s/g, "").length;
    const weak =
      result.totalTTC === undefined ||
      (result.confidence < 0.5 && nonBlank < 350) ||
      result.confidence < 0.2;

    if (weak) {
      try {
        const ocr = await ocrPdf(input.fileBuffer);
        if (ocr.text.replace(/\s/g, "").length > 15) {
          const ocrResult = buildParsedInvoice(ocr.text, "heuristique + OCR");
          // On adopte l'OCR s'il est nettement meilleur, ou si le texte natif
          // n'a rien donné de fiable.
          if (
            ocrResult.confidence > result.confidence + 0.1 ||
            result.totalTTC === undefined
          ) {
            ocrResult.warnings.unshift(
              "PDF scanné : le texte a été reconstruit automatiquement (OCR). " +
                "Vérifiez attentivement les montants, les dates et le numéro.",
            );
            result = this.degradeIfNoisyOcr(ocrResult, ocr.meanConfidence);
          }
          result.warnings.push(...ocr.warnings);
        } else {
          result.warnings.push(...ocr.warnings);
        }
      } catch (e) {
        console.error("OCR du PDF impossible :", e);
      }
    }

    if (result.confidence === 0 && result.warnings.length === 0) {
      result.warnings.push(
        "Impossible de lire automatiquement ce document. Veuillez saisir les informations manuellement.",
      );
    }
    return result;
  }

  /** Un OCR de mauvaise qualité ne doit jamais présenter des montants comme sûrs. */
  private degradeIfNoisyOcr(result: ParsedInvoice, meanConfidence?: number): ParsedInvoice {
    if (meanConfidence !== undefined && meanConfidence < 55) {
      return {
        ...result,
        confidence: 0,
        amountsUncertain: true,
        warnings: [
          "Reconnaissance de texte de trop mauvaise qualité pour être exploitée : " +
            "saisissez les informations manuellement.",
          ...result.warnings,
        ],
      };
    }
    if (meanConfidence !== undefined && meanConfidence < 75) {
      return {
        ...result,
        confidence: Math.min(result.confidence, 0.4),
        amountsUncertain: true,
      };
    }
    return result;
  }
}
