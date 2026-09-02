import { describe, expect, it } from "vitest";
import { normalizePartyName } from "./party";

describe("normalizePartyName", () => {
  it("ignore la casse, les accents et les espaces multiples", () => {
    expect(normalizePartyName("Éléctricité Générale")).toBe(normalizePartyName("electricite generale"));
    expect(normalizePartyName("OVH   SAS")).toBe(normalizePartyName("ovh sas"));
  });

  it("ignore les formes juridiques (SARL, SAS, EURL…)", () => {
    expect(normalizePartyName("Studio Pixel SARL")).toBe(normalizePartyName("Studio Pixel"));
    expect(normalizePartyName("FTFM La Toulousaine S.A.S")).toBe(normalizePartyName("FTFM La Toulousaine"));
  });

  it("distingue deux tiers différents", () => {
    expect(normalizePartyName("Boulangerie Martin")).not.toBe(normalizePartyName("Boulangerie Durand"));
  });

  it("gère les valeurs vides", () => {
    expect(normalizePartyName(null)).toBe("");
    expect(normalizePartyName("  ")).toBe("");
  });
});
