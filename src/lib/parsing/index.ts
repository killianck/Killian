// Point d'entrée de l'analyse des factures.
//
// Choisit l'analyseur selon la variable d'environnement INVOICE_PARSER :
//   - "heuristic" (défaut) : lit le texte du PDF et repère les infos courantes
//   - "stub"               : ne fait rien (saisie 100 % manuelle)
//   - (à venir) "openai", "mistral", "azure-document-intelligence"...
//
// Pour ajouter un moteur OCR/IA : créer une classe qui implémente InvoiceParser
// et l'ajouter dans le `switch` ci-dessous. Le reste de l'application n'a pas
// besoin d'être modifié.

import type { InvoiceParser } from "./types";
import { HeuristicParser } from "./heuristicParser";
import { StubParser } from "./stubParser";

export function getInvoiceParser(): InvoiceParser {
  const engine = (process.env.INVOICE_PARSER ?? "heuristic").toLowerCase();
  switch (engine) {
    case "stub":
      return new StubParser();
    // case "openai":
    //   return new OpenAiParser(process.env.INVOICE_PARSER_API_KEY!);
    case "heuristic":
    default:
      return new HeuristicParser();
  }
}

export type { InvoiceParser, ParsedInvoice } from "./types";
