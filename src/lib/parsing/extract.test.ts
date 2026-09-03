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
    const d = extractDates(FACTURE_SIMPLE);
    expect(d.invoiceDate).toBe("2026-03-15");
    expect(d.dueDate).toBe("2026-04-14");
    expect(d.notes).toEqual([]);
  });
  it("lit la date libellée « Date : »", () => {
    expect(extractDates(FACTURE_MULTI_TAUX).invoiceDate).toBe("2026-04-03");
  });
  it("signale une date de facture devinée (aucun libellé)", () => {
    const d = extractDates("STUDIO PIXEL\n15/08/2026\nPrestation\nTotal 100,00");
    expect(d.invoiceDate).toBe("2026-08-15");
    expect(d.notes.some((n) => /non libellée/i.test(n))).toBe(true);
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

describe("facture scannée (OCR) : totaux en tableau, libellés séparés des valeurs", () => {
  // Texte proche de ce que produit l'OCR sur une facture de transport scannée.
  const OCR_TABLEAU = `Transports MILLO-TRUCY
SIRET : 932 031 883 000 14
N° TVA : FR 459 320 318 83

Facture N° Date Référence
FAT000546 08/06/2026

LE 14/4/2026 RECEPTION FUTUROL 1,00 15,08 15,08 15,08
ENTREPOSAGE EXTERIEUR AVRIL ET MAI 2,00 90,00 90,00 180,00
Code Base Taux Taxe Total HT Total TTC Acompte | NET A PAYER
c20 422,96 20% 84,59 422,96 507,55 0,00 507,55
Total 422,96 84,59 IBAN FR76 3000 3035 4900 0200 7686 179
Nos factures sont payables dès réception ; 2 % de pénalités par mois de retard
et une indemnité forfaitaire de 40 € (décret N° 2012-1115 du 2/10/12)
En cas de contestation le Tribunal d'Aix en Provence est seul compétent`;

  it("reconstitue HT / TVA / TTC depuis la ligne de totaux", () => {
    const a = extractAmounts(OCR_TABLEAU);
    expect(a.totalHT).toBe(422.96);
    expect(a.totalVAT).toBe(84.59);
    expect(a.totalTTC).toBe(507.55);
  });

  it("lit le numéro sur la ligne suivant « Facture N° »", () => {
    expect(extractInvoiceNumber(OCR_TABLEAU)).toBe("FAT000546");
  });

  it("ne prend pas une date ou un numéro de loi/décret du bas de page", () => {
    const p = buildParsedInvoice(OCR_TABLEAU, "ocr");
    expect(p.number).toBe("FAT000546");
    expect(p.invoiceDate).toBe("2026-06-08");
    expect(p.dueDate).toBeUndefined();
    expect(p.totalHT).toBe(422.96);
    expect(p.totalVAT).toBe(84.59);
    expect(p.totalTTC).toBe(507.55);
    expect(p.vatLines).toEqual([{ rate: 20, baseHT: 422.96, vatAmount: 84.59 }]);
    expect(p.warnings.some((w) => w.includes("HT + TVA"))).toBe(false);
  });
});

describe("fiabilité des montants (garde-fous)", () => {
  it("ne fusionne pas une quantité collée au prix (« 1  2 500,00 »)", () => {
    const a = extractAmounts(
      "Création site vitrine   1   2 500,00   2 500,00\nTotal HT 2 500,00\nTVA 20 % 500,00\nTotal TTC 3 000,00",
    );
    expect(a.totalHT).toBe(2500);
    expect(a.totalVAT).toBe(500);
    expect(a.totalTTC).toBe(3000);
  });

  it("n'invente pas de triplet à partir d'une ligne d'acompte (2,1 % fortuit)", () => {
    const a = extractAmounts("Acompte 500,00 sur 23 800,00");
    expect(a.totalHT).toBeUndefined();
    expect(a.totalVAT).toBeUndefined();
    expect(a.totalTTC).toBeUndefined();
  });

  it("ne prend pas « Total des remises » comme TTC", () => {
    const a = extractAmounts("Total HT   1 000,00\nTotal des remises accordées : 60,00");
    expect(a.totalTTC).toBeUndefined();
    expect(a.totalVAT).toBeUndefined();
  });

  it("lit une ligne « Base HT … / Montant de TVA … » sans permuter HT et TVA", () => {
    const a = extractAmounts(
      "Base HT soumise à TVA :   2 000,00\nTaux : 20 %\nMontant de TVA :   400,00\nTotal TTC :   2 400,00",
    );
    expect(a.totalHT).toBe(2000);
    expect(a.totalVAT).toBe(400);
    expect(a.totalTTC).toBe(2400);
  });

  it("ignore un pourcentage de remise dans la détection des taux", () => {
    const a = extractAmounts(
      "Remise commerciale -15 %\nTVA 20 % base 1 000,00 taxe 200,00\nTotal HT 1 000,00\nTotal TTC 1 200,00",
    );
    expect(a.rates).toEqual([20]);
  });

  it("marque « incertain » une facture dont un total est calculé", () => {
    const p = buildParsedInvoice(
      "FACTURE N° X1\nDate de facture : 15/08/2026\nTotal HT 1 000,00\nTotal TTC 1 200,00",
      "heuristic",
    );
    expect(p.totalVAT).toBe(200);
    expect(p.amountsUncertain).toBe(true);
    expect(p.confidence).toBeLessThanOrEqual(0.5);
  });

  it("un avoir à montants négatifs est stocké en positif", () => {
    const p = buildParsedInvoice(
      "AVOIR N° AV-3\nDate de facture : 15/08/2026\nTotal HT -1 000,00\nTVA 20 % -200,00\nTotal TTC -1 200,00",
      "heuristic",
    );
    expect(p.documentType).toBe("avoir");
    expect(p.totalHT).toBe(1000);
    expect(p.totalVAT).toBe(200);
    expect(p.totalTTC).toBe(1200);
    expect(p.warnings.some((w) => /valeur positive/i.test(w))).toBe(true);
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
