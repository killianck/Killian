// Export Excel (.xlsx) des factures.
// Architecture : cette fonction ne dépend que d'une liste de factures ;
// d'autres exports (comptables) pourront être ajoutés à côté sans la modifier.

import ExcelJS from "exceljs";
import { CATEGORIES, DIRECTIONS, DOCUMENT_TYPES, labelOf } from "@/lib/domain/enums";
import { MONTH_NAMES_FR } from "@/lib/format";

export type ExportableInvoice = {
  invoiceDate: Date;
  dueDate: Date | null;
  number: string | null;
  partyName: string | null;
  documentType: string;
  direction: string;
  category: string | null;
  totalHT: number;
  totalVAT: number;
  totalTTC: number;
  currency: string;
  deductible: boolean;
  vatLines: { rate: number }[];
};

export async function buildInvoicesWorkbook(invoices: ExportableInvoice[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.created = new Date();
  const ws = wb.addWorksheet("Factures");

  ws.columns = [
    { header: "Date", key: "date", width: 12 },
    { header: "Échéance", key: "due", width: 12 },
    { header: "Numéro", key: "number", width: 16 },
    { header: "Fournisseur / Client", key: "party", width: 28 },
    { header: "Type", key: "type", width: 12 },
    { header: "Sens", key: "direction", width: 18 },
    { header: "Catégorie", key: "category", width: 16 },
    { header: "HT", key: "ht", width: 12 },
    { header: "TVA", key: "tva", width: 12 },
    { header: "TTC", key: "ttc", width: 12 },
    { header: "Taux TVA", key: "rates", width: 14 },
    { header: "TVA récupérable", key: "deductible", width: 15 },
    { header: "Mois", key: "month", width: 12 },
    { header: "Année", key: "year", width: 8 },
  ];
  ws.getRow(1).font = { bold: true };

  for (const inv of invoices) {
    const d = new Date(inv.invoiceDate);
    ws.addRow({
      date: d,
      due: inv.dueDate ? new Date(inv.dueDate) : "",
      number: inv.number ?? "",
      party: inv.partyName ?? "",
      type: DOCUMENT_TYPES[inv.documentType as keyof typeof DOCUMENT_TYPES] ?? inv.documentType,
      direction: DIRECTIONS[inv.direction as keyof typeof DIRECTIONS] ?? inv.direction,
      category: labelOf(CATEGORIES, inv.category),
      ht: inv.totalHT,
      tva: inv.totalVAT,
      ttc: inv.totalTTC,
      rates: [...new Set(inv.vatLines.map((l) => l.rate))].join(" / "),
      deductible: inv.direction === "achat" ? (inv.deductible ? "Oui" : "Non") : "",
      month: MONTH_NAMES_FR[d.getMonth()],
      year: d.getFullYear(),
    });
  }

  ws.getColumn("date").numFmt = "dd/mm/yyyy";
  ws.getColumn("due").numFmt = "dd/mm/yyyy";
  for (const key of ["ht", "tva", "ttc"]) {
    ws.getColumn(key).numFmt = '# ##0.00 "€"';
  }

  const arrayBuffer = await wb.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer as ArrayBuffer);
}
