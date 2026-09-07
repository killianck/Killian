import { describe, expect, it } from "vitest";
import { buildParsedInvoice, extractAmounts, extractDates } from "./extract";

// Batterie de mises en page variées — garde-fou anti-régression après la
// correction des factures multi-livraisons (Total HT d'un bloc de totaux vs
// sous-total de section ; SIRET / n° TVA du bon parti).

describe("robustesse extraction — mises en page variées", () => {
  it("facture native simple, fournisseur en tête avec SARL", () => {
    const t = `IMPRIMERIE DUPONT SARL
14 rue Gutenberg — 75010 Paris
SIRET 111 222 333 00044 — TVA FR40 111 222 333

FACTURE N° 2026-0451
Date : 12/05/2026
Échéance : 11/06/2026

Client : Cabinet Legrand
Total HT        1 250,00 €
TVA 20 %          250,00 €
Total TTC       1 500,00 €`;
    const p = buildParsedInvoice(t, "heuristic");
    expect(p.partyName).toBe("IMPRIMERIE DUPONT SARL");
    expect(p.siret).toBe("11122233300044");
    expect(p.vatNumber).toBe("FR40111222333");
    expect(p.invoiceDate).toBe("2026-05-12");
    expect(p.dueDate).toBe("2026-06-11");
    expect(p.totalHT).toBe(1250);
    expect(p.totalVAT).toBe(250);
    expect(p.totalTTC).toBe(1500);
  });

  it("bloc « Facturé à » entre le fournisseur et les totaux", () => {
    const t = `GARAGE CENTRAL
ZA des Peupliers, 44300 Nantes

Facturé à :
SCI DU PARC
8 allée des Tilleuls
44000 Nantes
SIRET : 555 666 777 00088

Facture FA-2026-77 du 03/06/2026

Prestation entretien véhicule
Montant HT ................ 800,00
TVA 20% .................. 160,00
Montant TTC .............. 960,00

SARL GARAGE CENTRAL au capital de 20 000 € - RCS Nantes 222 333 444 00055`;
    const p = buildParsedInvoice(t, "heuristic");
    expect(p.siret).toBe("22233344400055"); // celui des mentions légales, pas 555...088
    expect(p.totalHT).toBe(800);
    expect(p.totalVAT).toBe(160);
    expect(p.totalTTC).toBe(960);
    expect(p.invoiceDate).toBe("2026-06-03");
  });

  it("récapitulatif multi-taux (5,5 % + 20 %)", () => {
    const t = `TRAITEUR BONNE TABLE
FACTURE N° T-4589
Date de facture : 20/04/2026

Base 5,50 %      200,00      11,00
Base 20,00 %     500,00     100,00

Total HT          700,00
Total TVA         111,00
Total TTC         811,00`;
    const p = buildParsedInvoice(t, "heuristic");
    expect(p.totalHT).toBe(700);
    expect(p.totalVAT).toBe(111);
    expect(p.totalTTC).toBe(811);
    expect(p.vatLines?.map((l) => l.rate).sort((a, b) => a - b)).toEqual([5.5, 20]);
  });

  it("avoir à montants négatifs → stocké positif", () => {
    const t = `AVOIR N° AV-2026-12
Date : 15/06/2026
Fournisseur : PAPETERIE MODERNE
Total HT   -300,00
TVA 20 %    -60,00
Total TTC  -360,00`;
    const p = buildParsedInvoice(t, "heuristic");
    expect(p.documentType).toBe("avoir");
    expect(p.totalHT).toBe(300);
    expect(p.totalTTC).toBe(360);
  });

  it("facture sans TVA (auto-entrepreneur, franchise en base)", () => {
    const t = `Jean MARTIN — Consultant
FACTURE 2026-018
Émise le 02/07/2026
TVA non applicable, art. 293 B du CGI
Total : 1 500,00 €
Net à payer : 1 500,00 €`;
    const p = buildParsedInvoice(t, "heuristic");
    expect(p.invoiceDate).toBe("2026-07-02");
    expect(p.totalTTC).toBe(1500);
  });

  it("totaux en tableau, TTC observé qui doit primer sur un sous-total HT lu ailleurs", () => {
    const t = `FOURNISSEUR X
Détail par livraison
Livraison 1
Montant HT 1 000,00
Livraison 2
Montant HT 400,00
Total HT      TVA 20 %      Total TTC
1 400,00      280,00        1 680,00
Net à payer 1 680,00`;
    const p = buildParsedInvoice(t, "heuristic");
    expect(p.totalHT).toBe(1400);
    expect(p.totalVAT).toBe(280);
    expect(p.totalTTC).toBe(1680);
  });

  it("ne bricole pas un triplet quand seul un HT est présent", () => {
    const t = `DEVIS N° D-99
Montant HT 2 500,00
Bon pour accord`;
    const p = buildParsedInvoice(t, "heuristic");
    expect(p.totalVAT).toBeUndefined();
    expect(p.totalTTC).toBeUndefined();
  });
});

describe("régressions constatées sur de VRAIES factures (audit 2026-09-07)", () => {
  it("un en-tête de colonnes n'est pas un bloc de totaux : pas de TVA inventée depuis une ligne d'article", () => {
    // Facture NORALIS réelle : la ligne d'article « 21 044,89 € / 2 089,78 € »
    // affichait un ratio de 9,93 % — assimilé à 10 % — et l'en-tête
    // « Désignation … Total HT » la faisait passer pour une ligne de totaux.
    // Résultat : TVA lue 2 089,78 € au lieu de 1 171,74 € (+918 € de TVA déductible).
    const t = `P Désignation PUHT Qté Total HT
1 Coulissant 2 rails 2 vantaux 001 21 044,89 € 2 089,78 €
Net à payer : 7 030,42 €
TVA (20 %) :
Total TTC :
1 171,74 €
7 030,42 €
Total HT : 5 858,68 €`;
    const a = extractAmounts(t);
    expect(a.totalHT).toBe(5858.68);
    expect(a.totalVAT).toBe(1171.74);
    expect(a.totalTTC).toBe(7030.42);
    expect(a.totalHT! + a.totalVAT!).toBeCloseTo(a.totalTTC!, 2);
  });

  it("« Date de prélèvement » est une échéance, jamais la date de facture", () => {
    // Facture d'électricité réelle : datée du 08/07, prélevée le 25/08.
    // L'ancienne version la classait en août -> mauvais mois de TVA.
    const t = `FACTURE D'ELECTRICITE du 08 juillet 2026
Montant TTC 458,16 €
Date de prélèvement de cette facture le 25/08/2026
N° de facture : 105006519306
Date de facture : 08/07/26`;
    const d = extractDates(t);
    expect(d.invoiceDate).toBe("2026-07-08");
    expect(d.dueDate).toBe("2026-08-25");
  });

  it("un libellé explicite « Date de facture » l'emporte sur une « Date : » plus haut", () => {
    const t = `Date : 25/07/2026
Prestation
Date de facture : 15/07/2026`;
    expect(extractDates(t).invoiceDate).toBe("2026-07-15");
  });

  it("à défaut de libellé explicite, l'échéance n'est pas prise pour la date de facture", () => {
    const t = `Prestation du mois
15/07/2026
Date de prélèvement : 25/07/2026`;
    const d = extractDates(t);
    expect(d.invoiceDate).toBe("2026-07-15");
    expect(d.dueDate).toBe("2026-07-25");
  });
});
