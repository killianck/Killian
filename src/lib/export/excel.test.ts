import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { buildInvoicesWorkbook, type ExportableInvoice } from "./excel";

const invoices: ExportableInvoice[] = [
  {
    invoiceDate: new Date("2026-03-15"),
    dueDate: new Date("2026-04-14"),
    number: "F2026-001",
    partyName: "Boulangerie Martin",
    documentType: "facture",
    direction: "vente",
    category: "services",
    totalHT: 1000,
    totalVAT: 200,
    totalTTC: 1200,
    currency: "EUR",
    deductible: true,
    vatLines: [{ rate: 20 }],
  },
  {
    invoiceDate: new Date("2026-03-20"),
    dueDate: null,
    number: "FA-99",
    partyName: "Fournisseur X",
    documentType: "facture",
    direction: "achat",
    category: null,
    totalHT: 500,
    totalVAT: 100,
    totalTTC: 600,
    currency: "EUR",
    deductible: false,
    vatLines: [{ rate: 20 }],
  },
];

describe("buildInvoicesWorkbook", () => {
  it("produit un .xlsx relisible avec les bonnes colonnes et lignes", async () => {
    const buf = await buildInvoicesWorkbook(invoices);
    expect(buf.length).toBeGreaterThan(0);

    const wb = new ExcelJS.Workbook();
    await (wb.xlsx as unknown as { load: (b: unknown) => Promise<unknown> }).load(buf);
    const ws = wb.getWorksheet("Factures")!;
    expect(ws).toBeTruthy();

    const headers = (ws.getRow(1).values as unknown[]).filter(Boolean);
    expect(headers).toEqual(
      expect.arrayContaining(["Date", "Numéro", "HT", "TVA", "TTC", "TVA récupérable", "Mois", "Année"]),
    );

    // 1 ligne d'en-tête + 2 factures + 1 ligne de totaux
    expect(ws.rowCount).toBe(4);

    const row2 = ws.getRow(2).values as Record<string, unknown>;
    expect(Object.values(row2)).toContain("F2026-001");

    // La ligne de totaux somme HT (1000 + 500).
    const headerRow = ws.getRow(1).values as unknown[];
    const htCol = headerRow.indexOf("HT");
    expect(ws.getColumn(htCol).values[4]).toBe(1500);
  });

  it("marque « Non » pour un achat dont la TVA n'est pas récupérable", async () => {
    const buf = await buildInvoicesWorkbook(invoices);
    const wb = new ExcelJS.Workbook();
    await (wb.xlsx as unknown as { load: (b: unknown) => Promise<unknown> }).load(buf);
    const ws = wb.getWorksheet("Factures")!;
    // Colonne « TVA récupérable » = 12e (les clés ne sont pas conservées dans le .xlsx)
    const headerRow = ws.getRow(1).values as unknown[];
    const colIndex = headerRow.indexOf("TVA récupérable");
    expect(colIndex).toBeGreaterThan(0);
    const col = ws.getColumn(colIndex);
    expect(col.values[2]).toBe(""); // vente -> vide
    expect(col.values[3]).toBe("Non"); // achat non déductible
  });

  it("gère une liste vide", async () => {
    const buf = await buildInvoicesWorkbook([]);
    const wb = new ExcelJS.Workbook();
    await (wb.xlsx as unknown as { load: (b: unknown) => Promise<unknown> }).load(buf);
    expect(wb.getWorksheet("Factures")!.rowCount).toBe(1);
  });
});

describe("export Excel — devises et cohérence de la ligne TOTAL", () => {
  const base = {
    dueDate: null, number: "F1", partyName: "X", category: null,
    currency: "EUR", deductible: true, vatLines: [{ rate: 20 }],
  };

  it("la ligne TOTAL est cohérente (HT + TVA = TTC) et exclut les devises étrangères", async () => {
    const invoices = [
      { ...base, invoiceDate: new Date("2026-01-10"), documentType: "facture", direction: "achat",
        totalHT: 1000, totalVAT: 200, totalTTC: 1200 },
      { ...base, number: "F2", invoiceDate: new Date("2026-02-10"), documentType: "facture",
        direction: "achat", currency: "USD", totalHT: 5000, totalVAT: 1000, totalTTC: 6000 },
    ];
    const buf = await buildInvoicesWorkbook(invoices as never);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as never);
    const ws = wb.getWorksheet("Factures")!;
    const rows: unknown[][] = [];
    ws.eachRow((r) => rows.push((r.values as unknown[]).slice(1)));

    const header = rows[0] as string[];
    const iHT = header.indexOf("HT");
    const iTVA = header.indexOf("TVA");
    const iTTC = header.indexOf("TTC");
    const iCur = header.indexOf("Devise");
    expect(iCur).toBeGreaterThan(-1); // la devise doit être visible

    const total = rows[rows.length - 1];
    expect(total[iHT]).toBe(1000);
    expect(total[iTVA]).toBe(200); // et surtout PAS 1200 (USD inclus)
    expect(total[iTTC]).toBe(1200);
    expect(Number(total[iHT]) + Number(total[iTVA])).toBeCloseTo(Number(total[iTTC]), 2);
    expect(String(total[header.indexOf("Fournisseur / Client")])).toMatch(/USD.*exclue/);
  });
});
