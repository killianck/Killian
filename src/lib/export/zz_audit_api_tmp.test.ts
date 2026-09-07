import { describe, it } from "vitest";
import { buildInvoicesWorkbook } from "@/lib/export/excel";
import ExcelJS from "exceljs";

const base = {
  dueDate: null, number: "F1", partyName: "X", category: null,
  currency: "EUR", deductible: true, vatLines: [{ rate: 20 }],
};

describe("audit export", () => {
  it("ligne TOTAL vs colonnes", async () => {
    const invoices = [
      { ...base, invoiceDate: new Date("2026-01-10"), documentType: "facture", direction: "achat",
        totalHT: 1000, totalVAT: 200, totalTTC: 1200 },
      { ...base, number: "F2", invoiceDate: new Date("2026-02-10"), documentType: "facture", direction: "achat",
        currency: "USD", totalHT: 5000, totalVAT: 1000, totalTTC: 6000 },
    ];
    const buf = await buildInvoicesWorkbook(invoices as never);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as never);
    const ws = wb.getWorksheet("Factures")!;
    const rows: unknown[][] = [];
    ws.eachRow((r) => rows.push((r.values as unknown[]).slice(1)));
    for (const r of rows) console.log(JSON.stringify(r));
    const dataRows = rows.slice(1, -1);
    const colHT = dataRows.reduce((s, r) => s + Number(r[7]), 0);
    const colTVA = dataRows.reduce((s, r) => s + Number(r[8]), 0);
    const colTTC = dataRows.reduce((s, r) => s + Number(r[9]), 0);
    const total = rows[rows.length - 1];
    console.log("SOMME COLONNES  HT/TVA/TTC =", colHT, colTVA, colTTC);
    console.log("LIGNE   TOTAL   HT/TVA/TTC =", total[7], total[8], total[9]);
  });
});
