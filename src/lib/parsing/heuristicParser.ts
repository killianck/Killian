// Analyseur "heuristique" : lit le TEXTE du PDF et repère les informations
// courantes d'une facture française (montants, dates, numéro, TVA...).
//
// Ce n'est pas de l'IA : c'est un ensemble de règles. Le résultat doit toujours
// être vérifié par l'utilisateur. Pour une extraction plus fine (factures
// complexes, PDF scannés), on pourra brancher plus tard un service OCR/IA en
// ajoutant une nouvelle implémentation de InvoiceParser.

import type { InvoiceParser, ParsedInvoice, ParseInput } from "./types";
import { extractPdfText } from "./pdfText";
import { buildParsedInvoice } from "./extract";

export class HeuristicParser implements InvoiceParser {
  readonly name = "heuristic";

  async parse(input: ParseInput): Promise<ParsedInvoice> {
    let text = "";
    try {
      text = await extractPdfText(input.fileBuffer);
    } catch (e) {
      console.error("Lecture du texte du PDF impossible :", e);
      return {
        confidence: 0,
        engine: this.name,
        warnings: [
          "Impossible de lire automatiquement ce PDF. " +
            "Veuillez vérifier ou saisir les informations manuellement.",
        ],
      };
    }
    return buildParsedInvoice(text, this.name);
  }
}
