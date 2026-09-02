import { describe, expect, it } from "vitest";
import { findMoneyTokens, parseFrAmount } from "./frenchNumbers";

describe("parseFrAmount", () => {
  it("lit le format français", () => {
    expect(parseFrAmount("1 234,56 €")).toBe(1234.56);
    expect(parseFrAmount("1 234,56")).toBe(1234.56);
    expect(parseFrAmount("49,90")).toBe(49.9);
    expect(parseFrAmount("0,00")).toBe(0);
  });

  it("lit « 1.234,56 » (point milliers, virgule décimale)", () => {
    expect(parseFrAmount("1.234,56")).toBe(1234.56);
    expect(parseFrAmount("12.345.678,90")).toBe(12345678.9);
  });

  it("lit le format anglo-saxon « 1,234.56 »", () => {
    expect(parseFrAmount("1,234.56")).toBe(1234.56);
  });

  it("gère les séparateurs de milliers seuls", () => {
    expect(parseFrAmount("1.234")).toBe(1234);
    expect(parseFrAmount("1 234")).toBe(1234);
    expect(parseFrAmount("1,234")).toBe(1234);
  });

  it("gère les décimales simples", () => {
    expect(parseFrAmount("1234.5")).toBe(1234.5);
    expect(parseFrAmount("5,5")).toBe(5.5);
    expect(parseFrAmount("20")).toBe(20);
  });

  it("gère les montants négatifs (avoirs)", () => {
    expect(parseFrAmount("-49,90")).toBe(-49.9);
    expect(parseFrAmount("- 1 200,00 €")).toBe(-1200);
  });

  it("renvoie null si pas de nombre", () => {
    expect(parseFrAmount("néant")).toBeNull();
    expect(parseFrAmount("")).toBeNull();
    expect(parseFrAmount(null)).toBeNull();
  });
});

describe("findMoneyTokens", () => {
  it("récupère les montants alignés à droite d'une ligne", () => {
    expect(findMoneyTokens("Total HT                 1 000,00 €")).toEqual([1000]);
    expect(findMoneyTokens("20,00 %      1 000,00      200,00")).toEqual([1000, 200]);
  });
  it("ignore un pourcentage seul", () => {
    expect(findMoneyTokens("TVA 20%")).toEqual([]);
  });
});
