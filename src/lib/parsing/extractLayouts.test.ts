import { describe, expect, it } from "vitest";
import { buildParsedInvoice } from "./extract";

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
