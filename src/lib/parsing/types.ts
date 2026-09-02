// Interface d'analyse des factures.
//
// Objectif : pouvoir brancher plus tard un service d'OCR / d'IA (OpenAI,
// Mistral, Azure Document Intelligence...) SANS changer le reste du code.
// Il suffira d'ajouter une nouvelle implémentation de `InvoiceParser`.

export type ParsedVatLine = {
  rate: number;
  baseHT: number;
  vatAmount: number;
};

/** Données extraites d'une facture. Tous les champs sont optionnels : */
/** l'analyse automatique peut échouer partiellement, l'utilisateur complète. */
export type ParsedInvoice = {
  documentType?: "facture" | "avoir";
  number?: string;
  invoiceDate?: string; // ISO "AAAA-MM-JJ"
  dueDate?: string; // ISO "AAAA-MM-JJ"
  partyName?: string;
  partyAddress?: string;
  siret?: string;
  vatNumber?: string;
  currency?: string;

  totalHT?: number;
  totalVAT?: number;
  totalTTC?: number;
  vatLines?: ParsedVatLine[];

  /** Indice de confiance global de 0 à 1 (0 = rien trouvé). */
  confidence: number;
  /** Messages destinés à l'utilisateur (pas de codes techniques). */
  warnings: string[];
  /** Nom du moteur d'analyse utilisé. */
  engine: string;
};

export type ParseInput = {
  /** Contenu binaire du PDF. */
  fileBuffer: Buffer;
  fileName: string;
};

export interface InvoiceParser {
  readonly name: string;
  parse(input: ParseInput): Promise<ParsedInvoice>;
}
