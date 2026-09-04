import { describe, expect, it } from "vitest";
import {
  normRef,
  normParty,
  matchStatementLines,
  computeStatement,
  type CandidateInvoice,
  type StatementLineInput,
} from "./statements";

const inv = (over: Partial<CandidateInvoice>): CandidateInvoice => ({
  id: "i1",
  number: "F1",
  partyName: "Aix Store Provence",
  partyId: null,
  direction: "achat",
  documentType: "facture",
  isStatement: false,
  totalHT: 0,
  totalVAT: 0,
  totalTTC: 0,
  ...over,
});

// Relevé Aix Store : cumul HT 497,40 / TVA 99,48 / TTC 596,88 ; 2 lignes.
const GROSS = { ht: 497.4, vat: 99.48, ttc: 596.88 };
const LINES: StatementLineInput[] = [
  { reference: "260799F", amountHT: 491.4, amountVAT: 98.28, amountTTC: 589.68 },
  { reference: "2607338F", amountHT: 6, amountVAT: 1.2, amountTTC: 7.2 },
];

describe("normRef / normParty", () => {
  it("normalise les numéros et les noms", () => {
    expect(normRef(" 2607338-F ")).toBe("2607338F");
    expect(normRef("fat 000546")).toBe("FAT000546");
    expect(normParty("Aix Store Provence SARL")).toBe(normParty("aix  store  provence"));
  });
});

describe("matchStatementLines", () => {
  it("rapproche par numéro + fournisseur compatible", () => {
    const invoices = [
      inv({ id: "a", number: "2607338F", partyName: "Aix Store Provence", totalTTC: 7.2, totalHT: 6, totalVAT: 1.2 }),
      inv({ id: "b", number: "999", partyName: "Autre" }),
    ];
    const m = matchStatementLines({ partyName: "Aix Store Provence", partyId: null, direction: "achat" }, LINES, invoices);
    expect(m[0].matchedInvoiceId).toBeNull(); // 260799F pas dans le logiciel
    expect(m[1].matchedInvoiceId).toBe("a");
  });

  it("ne rapproche pas deux fournisseurs différents avec le même numéro", () => {
    const invoices = [inv({ id: "x", number: "2607338F", partyName: "Transports Millo-Trucy" })];
    const m = matchStatementLines({ partyName: "Aix Store Provence", partyId: null, direction: "achat" }, LINES, invoices);
    expect(m[1].matchedInvoiceId).toBeNull();
  });

  it("tolère un fournisseur inconnu d'un côté", () => {
    const invoices = [inv({ id: "x", number: "2607338F", partyName: null, totalTTC: 7.2 })];
    const m = matchStatementLines({ partyName: "Aix Store Provence", partyId: null, direction: "achat" }, LINES, invoices);
    expect(m[1].matchedInvoiceId).toBe("x");
  });

  it("une facture ne peut être rapprochée qu'à une seule ligne", () => {
    const invoices = [inv({ id: "x", number: "2607338F", totalTTC: 7.2 })];
    const doubled = [...LINES, { reference: "2607338F", amountTTC: 7.2 }];
    const m = matchStatementLines({ partyName: "Aix Store Provence", partyId: null, direction: "achat" }, doubled, invoices);
    expect(m.filter((x) => x.matchedInvoiceId === "x")).toHaveLength(1);
  });

  it("ignore les relevés et les factures de vente comme candidats", () => {
    const invoices = [
      inv({ id: "s", number: "2607338F", isStatement: true }),
      inv({ id: "v", number: "2607338F", direction: "vente" }),
    ];
    const m = matchStatementLines({ partyName: "Aix Store Provence", partyId: null, direction: "achat" }, LINES, invoices);
    expect(m[1].matchedInvoiceId).toBeNull();
  });
});

describe("computeStatement — compensation", () => {
  it("aucune facture saisie : le relevé compte pour son cumul entier", () => {
    const matches = matchStatementLines({ partyName: "Aix Store Provence", partyId: null, direction: "achat" }, LINES, []);
    const c = computeStatement(GROSS, LINES, matches);
    expect(c.totalHT).toBe(497.4);
    expect(c.totalVAT).toBe(99.48);
    expect(c.totalTTC).toBe(596.88);
    expect(c.matchedCount).toBe(0);
    expect(c.missingRefs).toEqual(["260799F", "2607338F"]);
    expect(c.coherence).toBe("a_verifier");
  });

  it("une facture saisie : le relevé rétrécit d'autant (pas de double comptage)", () => {
    const invoices = [inv({ id: "a", number: "2607338F", partyName: "Aix Store Provence", totalHT: 6, totalVAT: 1.2, totalTTC: 7.2 })];
    const matches = matchStatementLines({ partyName: "Aix Store Provence", partyId: null, direction: "achat" }, LINES, invoices);
    const c = computeStatement(GROSS, LINES, matches);
    expect(c.totalTTC).toBe(589.68);
    expect(c.totalHT).toBe(491.4);
    expect(c.totalVAT).toBe(98.28);
    // facture (7,20) + relevé restant (589,68) = cumul (596,88)
    expect(c.totalTTC + 7.2).toBeCloseTo(596.88, 2);
    expect(c.vatLines).toEqual([{ rate: 20, baseHT: 491.4, vatAmount: 98.28 }]);
    expect(c.missingRefs).toEqual(["260799F"]);
  });

  it("toutes les factures saisies : le relevé ne pèse plus rien", () => {
    const invoices = [
      inv({ id: "a", number: "260799F", partyName: "Aix Store Provence", totalHT: 491.4, totalVAT: 98.28, totalTTC: 589.68 }),
      inv({ id: "b", number: "2607338F", partyName: "Aix Store Provence", totalHT: 6, totalVAT: 1.2, totalTTC: 7.2 }),
    ];
    const matches = matchStatementLines({ partyName: "Aix Store Provence", partyId: null, direction: "achat" }, LINES, invoices);
    const c = computeStatement(GROSS, LINES, matches);
    expect(c.totalHT).toBe(0);
    expect(c.totalVAT).toBe(0);
    expect(c.totalTTC).toBe(0);
    expect(c.vatLines).toEqual([]);
    expect(c.coherence).toBe("coherent");
    expect(c.notes.join(" ")).toMatch(/entièrement rapproché/i);
  });

  it("répartit HT/TVA au prorata quand ni la ligne ni la facture rapprochée n'ont le HT", () => {
    const lines: StatementLineInput[] = [
      { reference: "260799F", amountTTC: 589.68 },
      { reference: "2607338F", amountTTC: 7.2 },
    ];
    // facture rapprochée pas encore analysée (montants à 0, seul le TTC compte via le relevé)
    const invoices = [inv({ id: "a", number: "2607338F", partyName: "Aix Store Provence", totalHT: 0, totalVAT: 0, totalTTC: 0 })];
    const matches = matchStatementLines({ partyName: "Aix Store Provence", partyId: null, direction: "achat" }, lines, invoices);
    const c = computeStatement(GROSS, lines, matches);
    expect(c.totalTTC).toBe(589.68);
    expect(c.totalHT).toBeCloseTo(491.4, 1);
    expect(c.notes.join(" ")).toMatch(/prorata/i);
  });

  it("signale un écart de montant entre le relevé et la facture rapprochée", () => {
    const invoices = [inv({ id: "a", number: "2607338F", partyName: "Aix Store Provence", totalHT: 8, totalVAT: 1.6, totalTTC: 9.6 })];
    const matches = matchStatementLines({ partyName: "Aix Store Provence", partyId: null, direction: "achat" }, LINES, invoices);
    const c = computeStatement(GROSS, LINES, matches);
    expect(c.notes.join(" ")).toMatch(/2607338F.*9\.60.*7\.20|7\.20.*9\.60/);
  });

  it("cumul absent : se rabat sur la somme des lignes", () => {
    const matches = matchStatementLines({ partyName: "X", partyId: null, direction: "achat" }, LINES, []);
    const c = computeStatement({}, LINES, matches);
    expect(c.totalTTC).toBe(596.88);
    expect(c.totalHT).toBe(497.4);
  });

  it("avertit (au lieu d'écrire 0 en silence) quand le HT/TVA n'a pas pu être lu du tout", () => {
    const lines: StatementLineInput[] = [
      { reference: "F001", amountTTC: 100 },
      { reference: "F002", amountTTC: 200 },
    ];
    const matches = matchStatementLines({ partyName: "X", partyId: null, direction: "achat" }, lines, []);
    const c = computeStatement({ ttc: 300 }, lines, matches); // ni ht ni vat connus, nulle part
    expect(c.totalHT).toBe(0);
    expect(c.notes.join(" ")).toMatch(/n'a pas pu être lu/i);
  });
});

describe("matchStatementLines — sens du document (achat/vente)", () => {
  it("un relevé ACHAT ne rapproche jamais une facture de VENTE, même même numéro/fournisseur", () => {
    const invoices = [inv({ id: "v", number: "2607338F", partyName: "Aix Store Provence", direction: "vente", totalTTC: 7.2 })];
    const m = matchStatementLines({ partyName: "Aix Store Provence", partyId: null, direction: "achat" }, LINES, invoices);
    expect(m[1].matchedInvoiceId).toBeNull();
  });

  it("un relevé VENTE ne rapproche que des factures de VENTE", () => {
    const achatInvoice = inv({ id: "a", number: "2607338F", partyName: "Aix Store Provence", direction: "achat", totalTTC: 7.2 });
    const venteInvoice = inv({ id: "v", number: "2607338F", partyName: "Aix Store Provence", direction: "vente", totalTTC: 7.2 });
    const m = matchStatementLines(
      { partyName: "Aix Store Provence", partyId: null, direction: "vente" },
      LINES,
      [achatInvoice, venteInvoice],
    );
    expect(m[1].matchedInvoiceId).toBe("v");
  });
});

describe("matchStatementLines — la facture déjà analysée fait autorité sur le montant de la ligne", () => {
  it("préfère le TTC de la facture rapprochée (déjà chiffrée) à celui, possiblement faux, imprimé sur le relevé", () => {
    // Cas « relevé de compte » : la colonne de droite est un SOLDE CUMULÉ, pas le
    // montant de la facture — la ligne indique 770 (solde) alors que la vraie
    // facture ne fait que 420.
    const lines: StatementLineInput[] = [{ reference: "FA20260512", amountTTC: 770 }];
    const invoices = [inv({ id: "a", number: "FA20260512", partyName: "X", totalHT: 350, totalVAT: 70, totalTTC: 420 })];
    const m = matchStatementLines({ partyName: "X", partyId: null, direction: "achat" }, lines, invoices);
    expect(m[0].ttc).toBe(420); // pas 770
    expect(m[0].amountMismatch).toEqual({ line: 770, invoice: 420 });
  });

  it("se rabat sur le montant de la ligne si la facture rapprochée n'est pas encore chiffrée", () => {
    const lines: StatementLineInput[] = [{ reference: "FA1", amountTTC: 100 }];
    const invoices = [inv({ id: "a", number: "FA1", partyName: "X", totalHT: 0, totalVAT: 0, totalTTC: 0 })];
    const m = matchStatementLines({ partyName: "X", partyId: null, direction: "achat" }, lines, invoices);
    expect(m[0].ttc).toBe(100);
    expect(m[0].amountMismatch).toBeUndefined();
  });
});

describe("computeStatement — rapprochement incertain (fournisseur inconnu d'un côté)", () => {
  it("ne marque jamais « coherent » un relevé entièrement rapproché par tolérance de fournisseur inconnu", () => {
    const lines: StatementLineInput[] = [{ reference: "FACT-001", amountTTC: 100, amountHT: 83.33, amountVAT: 16.67 }];
    // Facture d'un AUTRE fournisseur, pas encore analysée (partyName null) : le
    // numéro correspond mais rien ne garantit qu'il s'agit de la même facture.
    const invoices = [inv({ id: "y", number: "FACT-001", partyName: null, totalTTC: 0 })];
    const matches = matchStatementLines({ partyName: "Fournisseur X", partyId: null, direction: "achat" }, lines, invoices);
    expect(matches[0].uncertainParty).toBe(true);
    const c = computeStatement({ ttc: 100, ht: 83.33, vat: 16.67 }, lines, matches);
    expect(c.coherence).not.toBe("coherent");
    expect(c.notes.join(" ")).toMatch(/seul numéro/i);
  });
});

describe("computeStatement — lignes négatives (avoir inclus dans le relevé)", () => {
  it("une référence dont le seul montant est négatif n'est pas perdue : elle reste 'manquante'", () => {
    const lines: StatementLineInput[] = [
      { reference: "F1", amountTTC: 100 },
      { reference: "AV1", amountTTC: -20 },
    ];
    const matches = matchStatementLines({ partyName: "X", partyId: null, direction: "achat" }, lines, []);
    expect(matches.map((m) => m.ttc)).toEqual([100, -20]);
    const c = computeStatement({ ttc: 80 }, lines, matches); // 100 - 20 = 80 (cumul net)
    expect(c.missingRefs).toEqual(["F1", "AV1"]);
    expect(c.totalTTC).toBe(80); // rien n'est perdu : le crédit reste représenté
  });

  it("une fois la ligne positive rapprochée, le crédit associé n'est plus jamais floor-é à 0 en silence", () => {
    const lines: StatementLineInput[] = [
      { reference: "F1", amountTTC: 100 },
      { reference: "AV1", amountTTC: -20 },
    ];
    const invoices = [inv({ id: "a", number: "F1", partyName: "X", totalHT: 90, totalVAT: 10, totalTTC: 100 })];
    const matches = matchStatementLines({ partyName: "X", partyId: null, direction: "achat" }, lines, invoices);
    const c = computeStatement({ ttc: 80 }, lines, matches);
    // reste à couvrir = 80 (cumul net) - 100 (F1 rapprochée) = -20 → le crédit
    // (-20) est toujours "manquant" (AV1 non saisi), pas perdu silencieusement.
    expect(c.missingRefs).toEqual(["AV1"]);
  });
});

describe("computeStatement — double comptage entre deux relevés (référence non rapprochée listée deux fois)", () => {
  it("une même référence non rapprochée, listée sur deux relevés, n'est comptée qu'une fois (le plus récent)", () => {
    const lineJan: StatementLineInput[] = [{ reference: "F100", amountTTC: 100 }];
    const lineFeb: StatementLineInput[] = [{ reference: "F100", amountTTC: 100 }, { reference: "F200", amountTTC: 50 }];
    const matchesJan = matchStatementLines({ partyName: "X", partyId: null, direction: "achat" }, lineJan, []);
    const matchesFeb = matchStatementLines({ partyName: "X", partyId: null, direction: "achat" }, lineFeb, []);
    // Le relevé de janvier (plus ancien) reçoit F100 dans son crossCoveredRefs.
    const cJan = computeStatement({ ttc: 100 }, lineJan, matchesJan, new Set(["F100"]));
    const cFeb = computeStatement({ ttc: 150 }, lineFeb, matchesFeb); // pas de suppression : relevé le + récent
    expect(cJan.totalTTC).toBe(0); // F100 compté via février, pas ici
    expect(cJan.missingRefs).toEqual([]);
    expect(cFeb.totalTTC).toBe(150); // février compte F100 ET F200
    // Total agrégé (une seule fois F100) :
    expect(cJan.totalTTC + cFeb.totalTTC).toBe(150);
  });
});
