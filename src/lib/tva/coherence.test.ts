import { describe, expect, it } from "vitest";
import { checkCoherence } from "./coherence";

describe("checkCoherence", () => {
  it("valide une facture où HT + TVA = TTC", () => {
    const r = checkCoherence({
      totalHT: 1000,
      totalVAT: 200,
      totalTTC: 1200,
      vatLines: [{ rate: 20, baseHT: 1000, vatAmount: 200 }],
    });
    expect(r.level).toBe("coherent");
    expect(r.issues).toHaveLength(0);
  });

  it("signale une anomalie quand TTC est faux (1000 + 200 ≠ 1350)", () => {
    const r = checkCoherence({
      totalHT: 1000,
      totalVAT: 200,
      totalTTC: 1350,
      vatLines: [],
    });
    expect(r.level).toBe("incoherent");
    expect(r.issues.some((i) => i.severity === "error")).toBe(true);
  });

  it("gère plusieurs taux de TVA (20 % et 10 %)", () => {
    const r = checkCoherence({
      totalHT: 1500,
      totalVAT: 250,
      totalTTC: 1750,
      vatLines: [
        { rate: 20, baseHT: 1000, vatAmount: 200 },
        { rate: 10, baseHT: 500, vatAmount: 50 },
      ],
    });
    expect(r.level).toBe("coherent");
  });

  it("accepte une facture sans TVA (0 %)", () => {
    const r = checkCoherence({
      totalHT: 800,
      totalVAT: 0,
      totalTTC: 800,
      vatLines: [{ rate: 0, baseHT: 800, vatAmount: 0 }],
    });
    expect(r.level).toBe("coherent");
  });

  it("tolère les arrondis au centime", () => {
    const r = checkCoherence({
      totalHT: 99.99,
      totalVAT: 20,
      totalTTC: 119.99,
      vatLines: [{ rate: 20, baseHT: 99.99, vatAmount: 20 }],
    });
    expect(r.level).toBe("coherent");
  });

  it("signale une ligne dont la TVA ne correspond pas au taux", () => {
    const r = checkCoherence({
      totalHT: 1000,
      totalVAT: 250,
      totalTTC: 1250,
      vatLines: [{ rate: 20, baseHT: 1000, vatAmount: 250 }],
    });
    expect(r.issues.some((i) => i.severity === "warning")).toBe(true);
  });

  it("tolère un taux implicite proche de 20 % (arrondis facture télécom)", () => {
    const r = checkCoherence({
      totalHT: 165.81,
      totalVAT: 33.14,
      totalTTC: 198.95,
      vatLines: [],
    });
    expect(r.level).toBe("coherent");
  });

  it("signale un taux non standard", () => {
    const r = checkCoherence({
      totalHT: 1000,
      totalVAT: 170,
      totalTTC: 1170,
      vatLines: [{ rate: 17, baseHT: 1000, vatAmount: 170 }],
    });
    expect(r.issues.some((i) => i.message.includes("standard"))).toBe(true);
  });

  it("signale une TVA négative sur une facture (pas un avoir)", () => {
    const r = checkCoherence({ totalHT: 1000, totalVAT: -940, totalTTC: 60, vatLines: [] });
    expect(r.level).toBe("incoherent");
  });

  it("tolère les montants négatifs d'un avoir mais conseille le positif", () => {
    const r = checkCoherence({
      totalHT: -1000, totalVAT: -200, totalTTC: -1200, vatLines: [],
      documentType: "avoir",
    });
    expect(r.issues.some((i) => /positive/i.test(i.message))).toBe(true);
    expect(r.issues.some((i) => i.severity === "error")).toBe(false);
  });

  it("ne juge PAS cohérente une TVA grossièrement fausse (40 au lieu de 2000)", () => {
    const r = checkCoherence({ totalHT: 10000, totalVAT: 40, totalTTC: 10040, vatLines: [] });
    expect(r.level).not.toBe("coherent");
  });

  it("ne masque pas 60 € d'erreur de TVA sur une grosse ligne", () => {
    const r = checkCoherence({
      totalHT: 50000, totalVAT: 9940, totalTTC: 59940,
      vatLines: [{ rate: 20, baseHT: 50000, vatAmount: 9940 }],
    });
    expect(r.issues.some((i) => i.severity === "warning")).toBe(true);
  });

  it("signale une échéance antérieure à la date de facture", () => {
    const r = checkCoherence({
      totalHT: 1000, totalVAT: 200, totalTTC: 1200, vatLines: [],
      invoiceDate: "2026-06-15", dueDate: "2026-01-31",
    });
    expect(r.issues.some((i) => /échéance précède/i.test(i.message))).toBe(true);
  });

  it("signale une TVA qui dépasse le TTC", () => {
    const r = checkCoherence({ totalHT: 1000, totalVAT: 2000, totalTTC: 1200, vatLines: [] });
    expect(r.level).toBe("incoherent");
  });
});
