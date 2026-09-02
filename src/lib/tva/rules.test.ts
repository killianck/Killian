import { describe, expect, it } from "vitest";
import { isKnownVatRate, netVat, round2, vatContribution } from "./rules";

describe("isKnownVatRate", () => {
  it("reconnaît les taux français standards", () => {
    for (const r of [20, 10, 5.5, 2.1, 0]) {
      expect(isKnownVatRate(r)).toBe(true);
    }
  });
  it("rejette un taux inconnu", () => {
    expect(isKnownVatRate(17)).toBe(false);
    expect(isKnownVatRate(19.6)).toBe(false);
  });
});

describe("vatContribution", () => {
  it("une vente alimente la TVA collectée", () => {
    expect(vatContribution({ direction: "vente", documentType: "facture", vatAmount: 200 })).toEqual({
      collected: 200,
      deductible: 0,
    });
  });

  it("un achat alimente la TVA déductible", () => {
    expect(vatContribution({ direction: "achat", documentType: "facture", vatAmount: 60 })).toEqual({
      collected: 0,
      deductible: 60,
    });
  });

  it("un achat non déductible n'alimente rien", () => {
    expect(
      vatContribution({ direction: "achat", documentType: "facture", vatAmount: 60, deductible: false }),
    ).toEqual({ collected: 0, deductible: 0 });
  });

  it("un avoir inverse le signe", () => {
    expect(vatContribution({ direction: "vente", documentType: "avoir", vatAmount: 200 })).toEqual({
      collected: -200,
      deductible: 0,
    });
  });
});

describe("netVat", () => {
  it("TVA nette = collectée - déductible", () => {
    expect(netVat(1000, 300)).toBe(700);
  });
  it("peut être négative (crédit de TVA)", () => {
    expect(netVat(100, 400)).toBe(-300);
  });
});

describe("round2", () => {
  it("arrondit à 2 décimales", () => {
    expect(round2(19.999)).toBe(20);
    expect(round2(0.1 + 0.2)).toBe(0.3);
  });
});
