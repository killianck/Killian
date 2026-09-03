// =============================================================================
//  RÈGLES FISCALES FRANÇAISES — ZONE ISOLÉE
// =============================================================================
//
//  ⚠️  Tout ce qui dépend de la réglementation fiscale française doit être
//      regroupé ICI (et uniquement ici), pour pouvoir être vérifié et modifié
//      facilement sans toucher au reste de l'application.
//
//  Ce logiciel est un OUTIL DE SUIVI. Il ne remplace pas un expert-comptable
//  et ne produit pas de déclaration fiscale officielle. Les montants affichés
//  sont des ESTIMATIONS destinées au pilotage de l'entreprise.
// =============================================================================

/** Message à afficher partout où un résultat de TVA est présenté. */
export const TVA_DISCLAIMER =
  "Estimation de suivi — ne constitue pas une déclaration fiscale officielle. " +
  "Vérifiez avec votre expert-comptable.";

/**
 * Taux de TVA français courants (au moment de l'écriture de ce fichier).
 * `rate` est un pourcentage. Ajouter/retirer des lignes ici si la
 * réglementation change ou pour gérer des cas particuliers (DOM, etc.).
 */
export const VAT_RATES: ReadonlyArray<{ rate: number; label: string; note?: string }> = [
  { rate: 20, label: "20 %", note: "Taux normal" },
  { rate: 10, label: "10 %", note: "Taux intermédiaire" },
  { rate: 5.5, label: "5,5 %", note: "Taux réduit" },
  { rate: 2.1, label: "2,1 %", note: "Taux particulier" },
  { rate: 0, label: "0 %", note: "Non soumis / exonéré" },
];

export const KNOWN_VAT_RATES = VAT_RATES.map((r) => r.rate);

/**
 * Taux NON NULS utilisés par l'analyse automatique des factures pour reconnaître
 * un « taux de TVA » (par opposition à une remise, un acompte, une pénalité…).
 * Inclut les taux particuliers d'Outre-mer et de Corse.
 * SEULE source de vérité : l'extraction (src/lib/parsing) importe cette liste,
 * elle ne code aucun taux en dur.
 */
export const EXTRACTION_VAT_RATES = [20, 13, 10, 8.5, 5.5, 2.1, 1.75, 1.05, 0.9] as const;

/** Un taux est-il un taux français « standard » connu ? (sinon : à vérifier) */
export function isKnownVatRate(rate: number): boolean {
  return KNOWN_VAT_RATES.some((r) => Math.abs(r - rate) < 0.001);
}

/** Le taux fait-il partie des taux reconnus par l'analyse automatique ? */
export function isPlausibleVatRate(rate: number): boolean {
  return EXTRACTION_VAT_RATES.some((r) => Math.abs(r - rate) < 0.001);
}

// -----------------------------------------------------------------------------
//  Sens de la TVA
// -----------------------------------------------------------------------------
//
//  - Facture de VENTE (émise à un client)      -> TVA COLLECTÉE
//  - Facture d'ACHAT (reçue d'un fournisseur)  -> TVA DÉDUCTIBLE
//
//  Remarque : la déductibilité réelle de la TVA sur un achat dépend de règles
//  (nature de la dépense, usage professionnel, exclusions comme certains
//  véhicules ou frais...). Ici, on considère par défaut la TVA d'achat comme
//  déductible ; l'utilisateur peut exclure une facture via `deductible = false`
//  (à brancher plus tard dans l'interface).
// -----------------------------------------------------------------------------

export type VatContribution = {
  collected: number; // TVA collectée (ventes)
  deductible: number; // TVA déductible (achats)
};

/**
 * Contribution d'une facture au calcul de TVA.
 * Un AVOIR inverse le signe (il annule/réduit une facture).
 */
export function vatContribution(params: {
  direction: "achat" | "vente";
  documentType: "facture" | "avoir";
  vatAmount: number;
  deductible?: boolean; // pour les achats : TVA récupérable ? (défaut : oui)
}): VatContribution {
  const sign = params.documentType === "avoir" ? -1 : 1;
  const amount = sign * params.vatAmount;

  if (params.direction === "vente") {
    return { collected: amount, deductible: 0 };
  }
  // achat
  const isDeductible = params.deductible !== false;
  return { collected: 0, deductible: isDeductible ? amount : 0 };
}

/**
 * RÈGLE DE BASE : TVA nette = TVA collectée − TVA déductible.
 * (Un résultat positif = TVA à payer estimée ; négatif = crédit de TVA estimé.)
 */
export function netVat(collected: number, deductible: number): number {
  return round2(collected - deductible);
}

/**
 * Arrondi comptable à 2 décimales, symétrique (les valeurs négatives sont
 * arrondies avec la même règle que les positives : |−2,005| → 2,01 → −2,01).
 */
export function round2(n: number): number {
  if (!Number.isFinite(n)) return 0;
  const sign = n < 0 ? -1 : 1;
  return (sign * Math.round((Math.abs(n) + Number.EPSILON) * 100)) / 100;
}
