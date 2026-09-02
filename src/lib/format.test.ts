import { describe, expect, it } from "vitest";
import { addMonths, formatDate, formatMoney, formatRate, parseAmount } from "./format";

describe("addMonths", () => {
  it("avance d'un mois", () => {
    expect(addMonths(2026, 9, 1)).toEqual({ year: 2026, month: 10 });
  });
  it("recule d'un mois", () => {
    expect(addMonths(2026, 9, -1)).toEqual({ year: 2026, month: 8 });
  });
  it("passe à l'année suivante (décembre -> janvier)", () => {
    expect(addMonths(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
  });
  it("passe à l'année précédente (janvier -> décembre)", () => {
    expect(addMonths(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
  });
  it("gère un grand décalage", () => {
    expect(addMonths(2026, 6, 14)).toEqual({ year: 2027, month: 8 });
    expect(addMonths(2026, 6, -18)).toEqual({ year: 2024, month: 12 });
  });
});

// Intl utilise une espace insécable étroite (U+202F) comme séparateur de milliers.
const normalizeSpaces = (s: string) => s.replace(/ | /g, " ");

describe("formatMoney", () => {
  it("formate en euros à la française", () => {
    expect(normalizeSpaces(formatMoney(1250))).toBe("1 250,00 €");
    expect(normalizeSpaces(formatMoney(null))).toBe("0,00 €");
  });
});

describe("formatDate", () => {
  it("formate en JJ/MM/AAAA", () => {
    expect(formatDate("2026-08-15")).toBe("15/08/2026");
    expect(formatDate(null)).toBe("—");
  });
});

describe("formatRate", () => {
  it("affiche les taux proprement", () => {
    expect(formatRate(20)).toBe("20 %");
    expect(formatRate(5.5)).toBe("5,5 %");
  });
});

describe("parseAmount", () => {
  it("comprend les nombres saisis à la française", () => {
    expect(parseAmount("1 250,50")).toBe(1250.5);
    expect(parseAmount("1250.5")).toBe(1250.5);
    expect(parseAmount("1 234,56 €")).toBeCloseTo(1234.56);
  });
});
