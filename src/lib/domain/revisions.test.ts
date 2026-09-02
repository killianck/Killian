import { describe, expect, it } from "vitest";
import { diffInvoice } from "./revisions";

const base = {
  documentType: "facture",
  direction: "achat",
  category: "materiel",
  number: "F-1",
  invoiceDate: new Date("2026-03-01"),
  dueDate: null,
  partyName: "Fournisseur A",
  partyAddress: null,
  siret: null,
  vatNumber: null,
  currency: "EUR",
  totalHT: 1000,
  totalVAT: 200,
  totalTTC: 1200,
  notes: null,
  vatLines: [{ rate: 20, baseHT: 1000, vatAmount: 200 }],
};

describe("diffInvoice", () => {
  it("ne renvoie rien si rien ne change", () => {
    expect(diffInvoice(base, { ...base })).toHaveLength(0);
  });

  it("détecte un changement de montant", () => {
    const d = diffInvoice(base, { ...base, totalTTC: 1300 });
    expect(d).toHaveLength(1);
    expect(d[0].field).toBe("Total TTC");
    expect(d[0].oldValue).toBe("1200");
    expect(d[0].newValue).toBe("1300");
  });

  it("détecte l'ajout d'une date d'échéance et la formate", () => {
    const d = diffInvoice(base, { ...base, dueDate: new Date("2026-03-31") });
    expect(d[0].field).toBe("Date d'échéance");
    expect(d[0].oldValue).toBe("—");
    expect(d[0].newValue).toBe("31/03/2026");
  });

  it("détecte un changement de lignes de TVA", () => {
    const d = diffInvoice(base, {
      ...base,
      vatLines: [
        { rate: 20, baseHT: 800, vatAmount: 160 },
        { rate: 10, baseHT: 200, vatAmount: 20 },
      ],
    });
    expect(d.some((e) => e.field === "Lignes de TVA")).toBe(true);
  });

  it("utilise les libellés lisibles pour les listes déroulantes", () => {
    const d = diffInvoice(base, { ...base, direction: "vente" });
    expect(d[0].oldValue).toBe("Achat (fournisseur)");
    expect(d[0].newValue).toBe("Vente (client)");
  });
});
