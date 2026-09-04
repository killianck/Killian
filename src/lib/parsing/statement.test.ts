import { describe, expect, it } from "vitest";
import { detectStatement } from "./statement";
import { buildParsedInvoice } from "./extract";

// Relevé réel (Aix Store Provence / Actiforum) — 2 factures listées, seul le TTC
// par ligne, HT/TVA seulement en cumul.
const RELEVE_AIXSTORE = `RELEVE DE FACTURATION N° : 2607111RF MDP
105 Chemin de la Chênaie
13080 LUYNES
Compte client : 0380202
TVA Intracom. :FR26480377308
Mois : Juillet
Réf. Date Réf. cmde Réf. chantier P.T. TTC (Eur.) Règlement Echéance
260799F 03/07/2026 008164-26A1 ASTRUC 589,68 LCR directe 31/08/2026
2607338F 13/07/2026 008625-26A1 VENTE COMPTOIR DJ .. 7,20 LCR directe 31/08/2026
Cumul (Eur.) : Tot. escompte : 0,00
Tot. HT : 497,40
Tot. port : 0,00
Tot. TVA : 99,48
Tot. TTC : 596,88
Actiforum, 330 rue Victor Baltard, 13290 AIX EN PROVENCE
SARL au capital de 100 000€ • RCS Aix en Provence • SIRET 398 327 775 00027 • TVA FR82 398 327 775`;

describe("detectStatement", () => {
  it("reconnaît un relevé de facturation et lit ses lignes", () => {
    const s = detectStatement(RELEVE_AIXSTORE);
    expect(s).not.toBeNull();
    expect(s!.keyworded).toBe(true);
    expect(s!.sumMatchesTotal).toBe(true);
    expect(s!.lines.map((l) => l.reference)).toEqual(["260799F", "2607338F"]);
    expect(s!.lines.map((l) => l.amountTTC)).toEqual([589.68, 7.2]);
    expect(s!.grossHT).toBe(497.4);
    expect(s!.grossVAT).toBe(99.48);
    expect(s!.grossTTC).toBe(596.88);
    expect(s!.dueDate).toBe("2026-08-31");
  });

  it("répartit HT/TVA par ligne au prorata du TTC (un seul taux)", () => {
    const s = detectStatement(RELEVE_AIXSTORE)!;
    const l1 = s.lines[0];
    expect(l1.amountHT).toBe(491.4); // 497,40 × 589,68/596,88
    expect(l1.amountVAT).toBe(98.28);
    expect((s.lines[0].amountHT ?? 0) + (s.lines[1].amountHT ?? 0)).toBeCloseTo(497.4, 2);
  });

  it("récapitulatif sans mot-clé : accepté si ≥ 3 lignes et somme = total", () => {
    const t = `SOCIÉTÉ X — Point mensuel
F2026-101  02/07/2026  Chantier A   120,00
F2026-102  09/07/2026  Chantier B   240,00
F2026-103  20/07/2026  Chantier C   60,00
Total à payer TTC   420,00`;
    const s = detectStatement(t);
    expect(s).not.toBeNull();
    expect(s!.lines).toHaveLength(3);
  });

  it("ne déclenche pas sur une facture multi-livraisons (FUTUROL)", () => {
    const t = `Facture
FAC0049472 du 07/07/2026
Livraison N°114732 du 07/07/26 pour la commande CDF0123287
A1 Renorol Lame 43ST 1780 2 250 1,00 427,21 427,21
Montant HT 2 772,12
Livraison N°114765 du 07/07/26 pour la commande CDF0126181
B1 PieceDetachee 0 950 10,00 21,02 210,20
Montant HT 545,70
Total HT TVA: 20,00 % Montant TTC
3 317,82 € 663,56 € 3 981,38 €
Net à payer 3 981,38 €`;
    expect(detectStatement(t)).toBeNull();
  });

  it("ne déclenche pas sur une facture de transport à lignes multiples (MILLO)", () => {
    const t = `Transports MILLO-TRUCY
Facture N° FAT000546 08/06/2026
LE 14/4/2026 RECEPTION FUTUROL 1,00 15,08 15,08 15,08
LE 21/4/2026 RECEPTION FUTUROL 2,00 15,08 15,08 30,16
LE 28/4/2026 RECEPTION LA TOULOUSAINE 1,00 15,08 15,08 15,08
Code Base Taux Taxe Total HT Total TTC
C20 422,96 20% 84,59 422,96 507,55
Total 422,96 84,59`;
    expect(detectStatement(t)).toBeNull();
  });

  it("ne déclenche pas sur une facture simple à une seule ligne d'article", () => {
    const t = `FACTURE N° : 2607338F
Date : 13/07/2026
H194F Arrêt lame finale 4,0 1,50 6,00
Montant HT 6,00
TVA : 20,00% 1,20
Montant TTC 7,20`;
    expect(detectStatement(t)).toBeNull();
  });

  it("garde une ligne dont le seul montant est négatif (avoir inclus dans le relevé)", () => {
    const t = `SOCIÉTÉ X — Récapitulatif des factures
F2026-101  02/07/2026  Chantier A   120,00
F2026-102  09/07/2026  Chantier B   240,00
AV2026-9   15/07/2026  Avoir chantier B   -40,00
Total à payer TTC   320,00`;
    const s = detectStatement(t);
    expect(s).not.toBeNull();
    const neg = s!.lines.find((l) => l.reference === "AV2026-9");
    expect(neg?.amountTTC).toBe(-40);
    expect(s!.sumMatchesTotal).toBe(true); // 120 + 240 - 40 = 320
  });

  it("n'exige pas que la somme des lignes recoupe le total quand un mot-clé fort est présent", () => {
    // Le mot-clé suffit tant qu'aucun total n'a pu être lu (sumMatchesTotal
    // indéterminé) — mais si un total EST lu et ne correspond pas, ce n'est
    // probablement pas un relevé.
    const t = `Facture du mois de Juillet 2026
PLAN200 Abonnement Pro mensuel   49,00
OPT150 Option stockage +50Go     9,00
Total HT 58,00
TVA 20 % 11,60
Total TTC 69,60`;
    // ici KEYWORD matche ("facture...du mois") mais la somme des 2 lignes
    // d'articles (58,00) ne recoupe pas le Total TTC (69,60) : pas un relevé.
    expect(detectStatement(t)).toBeNull();
  });
});

describe("buildParsedInvoice — relevé", () => {
  it("marque isStatement et conserve le cumul comme totaux", () => {
    const p = buildParsedInvoice(RELEVE_AIXSTORE, "heuristic");
    expect(p.isStatement).toBe(true);
    expect(p.number).toBe("2607111RF");
    expect(p.totalHT).toBe(497.4);
    expect(p.totalVAT).toBe(99.48);
    expect(p.totalTTC).toBe(596.88);
    expect(p.statementLines).toHaveLength(2);
    expect(p.dueDate).toBe("2026-08-31");
    expect(p.warnings.some((w) => /RELEV[ÉE] de 2 facture/i.test(w))).toBe(true);
    expect(p.confidence).toBeLessThanOrEqual(0.7);
  });

  it("une facture normale n'est pas un relevé", () => {
    const p = buildParsedInvoice(
      "STUDIO PIXEL SARL\nFACTURE N° F1\nDate de facture : 15/03/2026\nTotal HT 2 500,00\nTVA 20 % 500,00\nTotal TTC 3 000,00",
      "heuristic",
    );
    expect(p.isStatement).toBeUndefined();
    expect(p.statementLines).toBeUndefined();
  });
});
