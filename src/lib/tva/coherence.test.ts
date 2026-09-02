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

  it("signale un taux non standard", () => {
    const r = checkCoherence({
      totalHT: 1000,
      totalVAT: 170,
      totalTTC: 1170,
      vatLines: [{ rate: 17, baseHT: 1000, vatAmount: 170 }],
    });
    expect(r.issues.some((i) => i.message.includes("standard"))).toBe(true);
  });
});
