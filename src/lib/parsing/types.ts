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

  /**
   * true si le document est un RELEVÉ / récapitulatif de plusieurs factures
   * (et non une facture qui facture quelque chose). Dans ce cas `totalHT/VAT/TTC`
   * portent le CUMUL imprimé sur le relevé et `statementLines` en donne le détail.
   */
  isStatement?: boolean;
  /** Détail des factures listées par le relevé (référence + montants). */
  statementLines?: {
    reference: string;
    label?: string;
    date?: string;
    dueDate?: string;
    amountHT?: number;
    amountVAT?: number;
    amountTTC?: number;
  }[];

  /** Indice de confiance global de 0 à 1 (0 = rien trouvé). */
  confidence: number;
  /**
   * true si les montants doivent être considérés comme NON fiables : un total
   * manque, a été calculé/deviné, ou HT + TVA ≠ TTC. Sert à ne jamais afficher
   * « cohérent » pour une facture dont l'analyse est incertaine.
   */
  amountsUncertain?: boolean;
  /** Messages destinés à l'utilisateur (pas de codes techniques). */
  warnings: string[];
  /** Nom du moteur d'analyse utilisé. */
  engine: string;
};

export type ParseInput = {
  /** Contenu binaire du fichier (PDF ou image). */
  fileBuffer: Buffer;
  fileName: string;
  /** Type MIME si connu (ex. "application/pdf", "image/jpeg"). */
  mimeType?: string;
};

export interface InvoiceParser {
  readonly name: string;
  parse(input: ParseInput): Promise<ParsedInvoice>;
}
