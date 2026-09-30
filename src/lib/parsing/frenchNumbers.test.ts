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

describe("findMoneyTokens — chiffre collé à un taux « % »", () => {
  it("lit le Total HT même juste après un taux, séparé par un simple espace de colonne", () => {
    // Ticket de caisse réel (Castorama) : « V5 TVA 20,00% 17,49 3,50 20,99 »
    // (code, TVA, taux, Total HT, Montant TVA, Total TTC). 17,49 est le Total HT
    // — une colonne différente, pas une décoration du taux — et ne doit donc
    // PAS être exclu au même titre que le taux lui-même.
    expect(findMoneyTokens("V5 TVA 20,00% 17,49 3,50 20,99")).toEqual([17.49, 3.5, 20.99]);
  });

  it("ignore toujours un taux vraiment COLLÉ (zéro espace) à la valeur suivante", () => {
    // Artefact de mise en page dégradée : « 444,90%20.00 » — le 20.00 est le
    // taux, littéralement soudé au montant sans le moindre espace.
    expect(findMoneyTokens("Montant TVA 444,90%20.00")).toEqual([444.9]);
  });
});
