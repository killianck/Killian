// Analyseur "heuristique" : lit le TEXTE du PDF et repère les informations
// courantes d'une facture française (montants, dates, numéro, TVA...).
//
// Ce n'est pas de l'IA : c'est un ensemble de règles. Le résultat doit toujours
// être vérifié par l'utilisateur.
//
// Deux sources de texte :
//   1. le texte intégré au PDF (rapide, fiable) ;
//   2. si le PDF est un scan (aucun texte), la reconnaissance de caractères
//      (OCR) reconstruit le texte à partir de l'image des pages.

import type { InvoiceParser, ParsedInvoice, ParseInput } from "./types";
import { extractPdfText } from "./pdfText";
import { buildParsedInvoice } from "./extract";
import { ocrPdf } from "./ocr";

export class HeuristicParser implements InvoiceParser {
  readonly name = "heuristic";

  async parse(input: ParseInput): Promise<ParsedInvoice> {
    let text = "";
    try {
      text = await extractPdfText(input.fileBuffer);
    } catch (e) {
      console.error("Lecture du texte du PDF impossible :", e);
    }

    let result = buildParsedInvoice(text, this.name);

    // Le PDF n'a pas de texte exploitable (scan / image) ou l'analyse est très
    // incomplète : on tente l'OCR. Plus lent, donc en dernier recours seulement.
    const weak = result.confidence < 0.35 || result.totalTTC === undefined;
    if (weak) {
      try {
        const ocrText = await ocrPdf(input.fileBuffer);
        if (ocrText.replace(/\s/g, "").length > 40) {
          const ocrResult = buildParsedInvoice(ocrText, "heuristique + OCR");
          if (ocrResult.confidence >= result.confidence) {
            ocrResult.warnings.unshift(
              "PDF scanné : le texte a été reconstruit automatiquement (OCR). " +
                "Vérifiez attentivement les montants, les dates et le numéro.",
            );
            result = ocrResult;
          }
        }
      } catch (e) {
        console.error("OCR du PDF impossible :", e);
      }
    }

    if (result.confidence === 0 && result.warnings.length === 0) {
      result.warnings.push(
        "Impossible de lire automatiquement ce PDF. " +
          "Veuillez saisir les informations manuellement.",
      );
    }
    return result;
  }
}
