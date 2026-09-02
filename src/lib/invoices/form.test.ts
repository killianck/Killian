import { describe, expect, it } from "vitest";
import { parseInvoiceForm } from "./form";

function fd(fields: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

describe("parseInvoiceForm", () => {
  it("refuse sans date de facture", () => {
    const r = parseInvoiceForm(fd({ documentType: "facture" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/date de facture/i);
  });

  it("calcule les totaux à partir des lignes de TVA", () => {
    const r = parseInvoiceForm(
      fd({
        documentType: "facture",
        direction: "achat",
        invoiceDate: "2026-03-15",
        vatLinesJson: JSON.stringify([{ rate: 20, baseHT: "1000", vatAmount: "200" }]),
      }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.totalHT).toBe(1000);
      expect(r.data.totalVAT).toBe(200);
      expect(r.data.totalTTC).toBe(1200);
      expect(r.coherence).toBe("coherent");
      expect(r.lines).toHaveLength(1);
    }
  });

  it("accepte des totaux saisis manuellement (format français)", () => {
    const r = parseInvoiceForm(
      fd({
        documentType: "facture",
        direction: "vente",
        invoiceDate: "2026-03-15",
        totalHT: "1 000,00",
        totalVAT: "200,00",
        totalTTC: "1 200,00",
        vatLinesJson: "[]",
      }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.totalTTC).toBe(1200);
      expect(r.data.direction).toBe("vente");
    }
  });

  it("signale une incohérence de montants", () => {
    const r = parseInvoiceForm(
      fd({
        documentType: "facture",
        direction: "achat",
        invoiceDate: "2026-03-15",
        totalHT: "1000",
        totalVAT: "200",
        totalTTC: "1350",
        vatLinesJson: "[]",
      }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.coherence).toBe("incoherent");
  });

  it("met les champs vides à null et la devise par défaut à EUR", () => {
    const r = parseInvoiceForm(
      fd({ documentType: "facture", direction: "achat", invoiceDate: "2026-01-01", vatLinesJson: "[]" }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.number).toBeNull();
      expect(r.data.dueDate).toBeNull();
      expect(r.data.currency).toBe("EUR");
    }
  });
});
