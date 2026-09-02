import { describe, expect, it } from "vitest";
import {
  buildParsedInvoice,
  extractAmounts,
  extractDates,
  extractDocumentType,
  extractInvoiceNumber,
  extractSiret,
  extractVatNumber,
} from "./extract";

const FACTURE_SIMPLE = `STUDIO PIXEL SARL
12 rue des Arts
75011 Paris
SIRET : 820 192 837 00025
TVA intracommunautaire : FR55 820 192 837

FACTURE N° F2026-0142

Date de facture : 15/03/2026
Date d'échéance : 14/04/2026

Client : Boulangerie Martin
5 avenue de la Gare
69003 Lyon

Désignation                     Qté      P.U. HT       Montant HT
Création site vitrine            1      2 500,00 €      2 500,00 €

Total HT                                                2 500,00 €
TVA 20 %                                                  500,00 €
Total TTC                                               3 000,00 €

Net à payer : 3 000,00 €`;

const FACTURE_MULTI_TAUX = `FACTURE N° 2026-77

Date : 03/04/2026

Récapitulatif de TVA
Taux         Base HT        Montant TVA
20,00 %     1 000,00          200,00
10,00 %       500,00           50,00

Total HT                     1 500,00
Total TVA                       250,00
Total TTC                     1 750,00`;

describe("extractInvoiceNumber", () => {
  it("lit le numéro de facture", () => {
    expect(extractInvoiceNumber(FACTURE_SIMPLE)).toBe("F2026-0142");
    expect(extractInvoiceNumber(FACTURE_MULTI_TAUX)).toBe("2026-77");
  });
});

describe("extractDates", () => {
  it("distingue date de facture et échéance", () => {
    expect(extractDates(FACTURE_SIMPLE)).toEqual({
      invoiceDate: "2026-03-15",
      dueDate: "2026-04-14",
    });
  });
  it("prend la première date à défaut", () => {
    expect(extractDates(FACTURE_MULTI_TAUX).invoiceDate).toBe("2026-04-03");
  });
  it("lit une date en toutes lettres", () => {
    expect(extractDates("Date de facture : 15 août 2026").invoiceDate).toBe("2026-08-15");
  });
});

describe("extractSiret / extractVatNumber", () => {
  it("lit le SIRET (14 chiffres)", () => {
    expect(extractSiret(FACTURE_SIMPLE)).toBe("82019283700025");
  });
  it("lit le numéro de TVA intracommunautaire", () => {
    expect(extractVatNumber(FACTURE_SIMPLE)).toBe("FR55820192837");
  });
});

describe("extractDocumentType", () => {
  it("détecte une facture", () => {
    expect(extractDocumentType(FACTURE_SIMPLE)).toBe("facture");
  });
  it("détecte un avoir", () => {
    expect(extractDocumentType("AVOIR N° AV-2026-003\nMontant : -120,00 €")).toBe("avoir");
  });
});

describe("extractAmounts", () => {
  it("lit HT, TVA, TTC et crée une ligne de TVA (taux unique)", () => {
    const a = extractAmounts(FACTURE_SIMPLE);
    expect(a.totalHT).toBe(2500);
    expect(a.totalVAT).toBe(500);
    expect(a.totalTTC).toBe(3000);
    expect(a.vatLines).toEqual([{ rate: 20, baseHT: 2500, vatAmount: 500 }]);
  });

  it("reconstitue le détail par taux (plusieurs taux)", () => {
    const a = extractAmounts(FACTURE_MULTI_TAUX);
    expect(a.totalHT).toBe(1500);
    expect(a.totalVAT).toBe(250);
    expect(a.totalTTC).toBe(1750);
    expect(a.vatLines).toHaveLength(2);
    expect(a.vatLines.map((l) => l.rate).sort()).toEqual([10, 20]);
  });

  it("calcule le montant manquant (TVA = TTC - HT)", () => {
    const a = extractAmounts("Total HT 1 000,00\nTotal TTC 1 200,00");
    expect(a.totalVAT).toBe(200);
  });

  it("gère une facture sans TVA", () => {
    const a = extractAmounts("Total HT 800,00\nTVA 0,00\nTotal TTC 800,00");
    expect(a.totalTTC).toBe(800);
  });
});

describe("cas réels (mise en page bruitée)", () => {
  const MESSY = `FTFM La Toulousaine - Route de Toulouse - 31676 LABEGE CEDEX - Tél +33 5 61 75 31 00
FACTURE mail : contact@exemple.fr
Code ClientDate N° FACTURE
23/06/2026 F012606FACLI02 8445 13MDP01
TOTAL H.T. 2 224,49
Montant TVA 444,90%20.00
TOTAL TTC 2 669,39EUR
Règlement au
31/07/2026
S.A.S au capital de 2 210 511 euros - SIRET 302 117 775 00023 - IDENTIFICATION T.V.A. : FR 81 302 117 775
N°FACTURE 2606F28445`;

  it("ne prend pas « mail » ni une date comme numéro", () => {
    expect(extractInvoiceNumber(MESSY)).toBe("2606F28445");
  });

  it("lit l'échéance quand la date est sur la ligne suivante", () => {
    expect(extractDates(MESSY).dueDate).toBe("2026-07-31");
  });

  it("lit le bon montant de TVA malgré « 444,90%20.00 »", () => {
    const a = extractAmounts(MESSY);
    expect(a.totalHT).toBe(2224.49);
    expect(a.totalVAT).toBe(444.9);
    expect(a.totalTTC).toBe(2669.39);
    expect(a.vatLines).toEqual([{ rate: 20, baseHT: 2224.49, vatAmount: 444.9 }]);
  });

  it("trouve le SIRET même noyé dans une ligne de pied de page", () => {
    expect(extractSiret(MESSY)).toBe("30211777500023");
  });
});

describe("buildParsedInvoice", () => {
  it("produit un résultat cohérent avec une bonne confiance", () => {
    const p = buildParsedInvoice(FACTURE_SIMPLE, "heuristic");
    expect(p.number).toBe("F2026-0142");
    expect(p.totalTTC).toBe(3000);
    expect(p.confidence).toBeGreaterThan(0.7);
    expect(p.warnings.some((w) => w.includes("HT + TVA"))).toBe(false);
  });

  it("signale un PDF scanné (aucun texte)", () => {
    const p = buildParsedInvoice("", "heuristic");
    expect(p.confidence).toBe(0);
    expect(p.warnings[0]).toMatch(/scan|image/i);
  });

  it("signale une incohérence de montants", () => {
    const p = buildParsedInvoice(
      "Total HT 1 000,00\nTotal TVA 200,00\nTotal TTC 1 350,00",
      "heuristic",
    );
    expect(p.warnings.some((w) => w.includes("HT + TVA"))).toBe(true);
  });
});
