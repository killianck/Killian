// -----------------------------------------------------------------------------
// Valeurs de référence du domaine (types, statuts, catégories...).
//
// Elles sont volontairement centralisées ici pour pouvoir être complétées
// facilement plus tard, sans les chercher partout dans le code.
// -----------------------------------------------------------------------------

/** Nature du document. */
export const DOCUMENT_TYPES = {
  facture: "Facture",
  avoir: "Avoir",
} as const;
export type DocumentType = keyof typeof DOCUMENT_TYPES;

/**
 * Sens de la facture :
 * - "achat"  = facture reçue d'un fournisseur  -> TVA déductible
 * - "vente"  = facture émise vers un client    -> TVA collectée
 */
export const DIRECTIONS = {
  achat: "Achat (fournisseur)",
  vente: "Vente (client)",
} as const;
export type Direction = keyof typeof DIRECTIONS;

/** Classement complet (type + sens), tel que demandé dans le cahier des charges. */
export const INVOICE_KINDS = {
  facture_fournisseur: "Facture fournisseur",
  facture_client: "Facture client",
  avoir_fournisseur: "Avoir fournisseur",
  avoir_client: "Avoir client",
} as const;
export type InvoiceKind = keyof typeof INVOICE_KINDS;

export function invoiceKind(documentType: DocumentType, direction: Direction): InvoiceKind {
  if (documentType === "avoir") {
    return direction === "achat" ? "avoir_fournisseur" : "avoir_client";
  }
  return direction === "achat" ? "facture_fournisseur" : "facture_client";
}

/** Catégorie comptable (facultative). Extensible. */
export const CATEGORIES = {
  materiel: "Matériel",
  sous_traitance: "Sous-traitance",
  transport: "Transport",
  fournitures: "Fournitures",
  services: "Services",
  autre: "Autre",
} as const;
export type Category = keyof typeof CATEGORIES;

/** Statut d'analyse / de validation d'une facture. */
export const STATUSES = {
  a_analyser: "À analyser",
  analyse_en_cours: "Analyse en cours",
  a_verifier: "À vérifier",
  validee: "Validée",
  erreur: "Erreur",
} as const;
export type Status = keyof typeof STATUSES;

/** Résultat des contrôles de cohérence des montants. */
export const COHERENCE_LEVELS = {
  coherent: "Données cohérentes",
  a_verifier: "Données à vérifier",
  incoherent: "Données probablement incorrectes",
} as const;
export type CoherenceLevel = keyof typeof COHERENCE_LEVELS;

// Petits utilitaires d'affichage (renvoient le libellé, ou la valeur brute si inconnue).
export const labelOf = <T extends Record<string, string>>(map: T, key: string | null | undefined) =>
  (key && map[key as keyof T]) || key || "—";
