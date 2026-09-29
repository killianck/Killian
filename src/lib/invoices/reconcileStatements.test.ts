// Tests de `reconcileStatements` — la partie qui ÉCRIT en base (les fonctions
// pures sont testées dans `statements.test.ts`).
//
// On utilise une fausse base en mémoire qui implémente juste les quelques appels
// Prisma utilisés : c'est suffisant pour vérifier ce qui est écrit, et ça évite
// une vraie base SQLite dans les tests.

import { describe, expect, it } from "vitest";
import { reconcileStatements } from "./statements";

type Row = Record<string, unknown>;

type FakeDb = Parameters<typeof reconcileStatements>[0] & {
  invoices: Row[];
  lines: Row[];
  vatLines: Row[];
};

function makeDb(invoices: Row[], lines: Row[]): FakeDb {
  const vatLines: Row[] = [];

  const db = {
    invoices,
    lines,
    vatLines,
    invoice: {
      findMany: async ({ where }: { where: { isStatement: boolean } }) =>
        invoices
          .filter((i) => i.isStatement === where.isStatement)
          .map((i) => ({ ...i, statementLines: lines.filter((l) => l.statementId === i.id) })),
      update: async ({ where, data }: { where: { id: string }; data: Row }) => {
        const row = invoices.find((i) => i.id === where.id);
        if (!row) throw new Error(`facture ${where.id} introuvable`);
        const { vatLines: nested, ...rest } = data as Row & {
          vatLines?: { create: Row[] };
        };
        Object.assign(row, rest);
        for (const l of nested?.create ?? []) vatLines.push({ ...l, invoiceId: where.id });
        return row;
      },
    },
    statementLine: {
      update: async ({ where, data }: { where: { id: string }; data: Row }) => {
        const row = lines.find((l) => l.id === where.id);
        if (!row) throw new Error(`ligne ${where.id} introuvable`);
        Object.assign(row, data);
        return row;
      },
    },
    vatLine: {
      deleteMany: async ({ where }: { where: { invoiceId: string } }) => {
        for (let i = vatLines.length - 1; i >= 0; i--) {
          if (vatLines[i].invoiceId === where.invoiceId) vatLines.splice(i, 1);
        }
        return { count: 0 };
      },
    },
    // Prisma exécute le tableau dans une transaction ; ici les opérations sont
    // déjà lancées (dans l'ordre de construction), il suffit de les attendre.
    $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops),
  };

  return db as unknown as FakeDb;
}

/** Relevé de 2 factures (596,88 € TTC), dont une seule est déposée. */
function scenario(statementOverrides: Row = {}) {
  const invoices: Row[] = [
    {
      id: "st1",
      isStatement: true,
      direction: "achat",
      documentType: "facture",
      number: "2607111RF",
      partyName: "Aix Store Provence",
      partyId: "p1",
      invoiceDate: new Date("2026-07-31T00:00:00Z"),
      totalHT: 497.4,
      totalVAT: 99.48,
      totalTTC: 596.88,
      statementGrossHT: 497.4,
      statementGrossVAT: 99.48,
      statementGrossTTC: 596.88,
      coherence: "a_verifier",
      notes: null,
      ...statementOverrides,
    },
    {
      id: "f1",
      isStatement: false,
      direction: "achat",
      documentType: "facture",
      number: "2607338F",
      partyName: "Aix Store Provence",
      partyId: "p1",
      invoiceDate: new Date("2026-07-12T00:00:00Z"),
      totalHT: 6,
      totalVAT: 1.2,
      totalTTC: 7.2,
    },
  ];
  const lines: Row[] = [
    { id: "l1", statementId: "st1", reference: "2607338F", amountHT: 6, amountVAT: 1.2, amountTTC: 7.2, matchedInvoiceId: null },
    { id: "l2", statementId: "st1", reference: "2607999F", amountHT: 491.4, amountVAT: 98.28, amountTTC: 589.68, matchedInvoiceId: null },
  ];
  return makeDb(invoices, lines);
}

const statement = (db: FakeDb) => db.invoices.find((i) => i.id === "st1")!;

describe("reconcileStatements — écriture en base", () => {
  it("rapproche la facture déposée et réduit le relevé d'autant", async () => {
    const db = scenario();
    await reconcileStatements(db);

    expect(db.lines.find((l) => l.id === "l1")!.matchedInvoiceId).toBe("f1");
    expect(db.lines.find((l) => l.id === "l2")!.matchedInvoiceId).toBe(null);

    const st = statement(db);
    expect(st.totalTTC).toBe(589.68);
    expect(st.totalHT).toBe(491.4);
    expect(st.totalVAT).toBe(98.28);
    // Le cumul imprimé n'est JAMAIS écrasé par la compensation.
    expect(st.statementGrossTTC).toBe(596.88);
  });

  it("recrée les lignes de TVA du reste à couvrir", async () => {
    const db = scenario();
    await reconcileStatements(db);
    expect(db.vatLines).toEqual([{ invoiceId: "st1", rate: 20, baseHT: 491.4, vatAmount: 98.28 }]);
  });

  it("est idempotent : un 2e passage ne réécrit rien", async () => {
    const db = scenario();
    await reconcileStatements(db);
    const after = { ...statement(db) };
    const lignesAvant = db.lines.map((l) => ({ ...l }));

    await reconcileStatements(db);
    expect({ ...statement(db) }).toEqual(after);
    expect(db.lines).toEqual(lignesAvant);
    // Pas de doublon de ligne de TVA au second passage.
    expect(db.vatLines).toHaveLength(1);
  });

  it("NE DÉTRUIT PAS la note écrite par l'utilisateur sur un relevé", async () => {
    // Un relevé dont l'utilisateur a annoté la fiche (« Modifier » propose un
    // champ Notes libre). Le rapprochement écrit ses propres explications : elles
    // ne doivent pas faire disparaître ce que l'utilisateur a saisi.
    const db = scenario({ notes: "Réglé par chèque le 12/08, vérifier avec le comptable." });
    await reconcileStatements(db);

    const st = statement(db);
    expect(st.notes).toContain("Réglé par chèque le 12/08");
    // Les explications du rapprochement restent disponibles, à leur place.
    expect(String(st.autoNotes)).toContain("Relevé rapproché à 1/2");
  });

  it("n'invente pas de note utilisateur quand il n'y en a pas", async () => {
    const db = scenario();
    await reconcileStatements(db);
    expect(statement(db).notes).toBe(null);
  });
});
