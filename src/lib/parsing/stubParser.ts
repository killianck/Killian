// Analyseur "stub" : ne lit pas le PDF, renvoie toujours "rien".
// Utile comme repli (INVOICE_PARSER="stub") ou pour les tests.

import type { InvoiceParser, ParsedInvoice, ParseInput } from "./types";

export class StubParser implements InvoiceParser {
  readonly name = "stub";

  async parse(input: ParseInput): Promise<ParsedInvoice> {
    void input;
    return {
      confidence: 0,
      engine: this.name,
      warnings: [
        "Analyse automatique désactivée. " +
          "Veuillez saisir ou vérifier les informations de la facture manuellement.",
      ],
    };
  }
}
