import { describe, expect, it } from "vitest";
import { totalsFromLines, vatOfLine } from "./lines";

describe("vatOfLine", () => {
  it("calcule la TVA d'une ligne", () => {
    expect(vatOfLine(1000, 20)).toBe(200);
    expect(vatOfLine(500, 5.5)).toBe(27.5);
    expect(vatOfLine(800, 0)).toBe(0);
  });
});

describe("totalsFromLines", () => {
  it("additionne une seule ligne", () => {
    expect(totalsFromLines([{ rate: 20, baseHT: 1000, vatAmount: 200 }])).toEqual({
      totalHT: 1000,
      totalVAT: 200,
      totalTTC: 1200,
    });
  });

  it("additionne plusieurs taux", () => {
    expect(
      totalsFromLines([
        { rate: 20, baseHT: 1000, vatAmount: 200 },
        { rate: 10, baseHT: 500, vatAmount: 50 },
      ]),
    ).toEqual({ totalHT: 1500, totalVAT: 250, totalTTC: 1750 });
  });

  it("gère une liste vide", () => {
    expect(totalsFromLines([])).toEqual({ totalHT: 0, totalVAT: 0, totalTTC: 0 });
  });

  it("ignore les valeurs non numériques", () => {
    // @ts-expect-error test de robustesse
    expect(totalsFromLines([{ rate: 20, baseHT: "abc", vatAmount: 200 }])).toEqual({
      totalHT: 0,
      totalVAT: 200,
      totalTTC: 200,
    });
  });
});
