// Analyseur "stub" : version minimale sans service externe.
//
// Pour l'instant il ne fait presque rien (il ne lit pas encore le contenu du
// PDF). Il sert de point de départ : l'utilisateur saisit/vérifie les données
// à la main. Quand une vraie analyse OCR/IA sera branchée, elle prendra la
// relève automatiquement via `getInvoiceParser()`.

import type { InvoiceParser, ParsedInvoice, ParseInput } from "./types";

export class StubParser implements InvoiceParser {
  readonly name = "stub";

  async parse(input: ParseInput): Promise<ParsedInvoice> {
    void input; // le stub n'analyse pas encore le contenu du PDF
    return {
      confidence: 0,
      engine: this.name,
      warnings: [
        "L'analyse automatique n'est pas encore activée. " +
          "Veuillez saisir ou vérifier les informations de la facture manuellement.",
      ],
    };
  }
}

/**
 * Sélectionne l'analyseur selon la variable d'environnement INVOICE_PARSER.
 * Ajouter ici les futurs moteurs ("openai", "mistral", ...).
 */
export function getInvoiceParser(): InvoiceParser {
  const engine = process.env.INVOICE_PARSER ?? "stub";
  switch (engine) {
    // case "openai":
    //   return new OpenAiParser(process.env.INVOICE_PARSER_API_KEY!);
    case "stub":
    default:
      return new StubParser();
  }
}
