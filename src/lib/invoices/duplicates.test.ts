import { describe, expect, it } from "vitest";
import { duplicateGroups, duplicateIds, duplicateKey, isDuplicatePair } from "./duplicates";

const base = { invoiceDate: "2026-06-23", totalTTC: 2669.39 };

describe("duplicateKey", () => {
  it("regroupe par numéro + tiers (insensible à la casse et aux espaces)", () => {
    expect(duplicateKey({ id: "1", number: "F-12", partyName: "  Fournisseur A ", ...base })).toBe(
      duplicateKey({ id: "2", number: "f-12", partyName: "fournisseur a", ...base }),
    );
  });

  it("sans numéro : regroupe par tiers + date + montant", () => {
    const a = { id: "1", number: null, partyName: "Client X", invoiceDate: "2026-01-05", totalTTC: 120 };
    const b = { id: "2", number: "", partyName: "Client X", invoiceDate: "2026-01-05", totalTTC: 120 };
    expect(duplicateKey(a)).toBe(duplicateKey(b));
  });

  it("renvoie null si pas assez d'infos", () => {
    expect(duplicateKey({ id: "1", number: null, partyName: null, invoiceDate: "2026-01-01", totalTTC: 0 })).toBeNull();
  });
});

describe("isDuplicatePair", () => {
  it("détecte deux imports de la même facture", () => {
    const a = { id: "a", number: "2606F28445", partyName: "FTFM La Toulousaine", ...base };
    const b = { id: "b", number: "2606F28445", partyName: "FTFM La Toulousaine", ...base };
    expect(isDuplicatePair(a, b)).toBe(true);
  });
  it("ne se compare pas à elle-même", () => {
    const a = { id: "a", number: "X", partyName: "Y", ...base };
    expect(isDuplicatePair(a, a)).toBe(false);
  });
  it("deux factures différentes ne sont pas des doublons", () => {
    const a = { id: "a", number: "F-1", partyName: "A", ...base };
    const b = { id: "b", number: "F-2", partyName: "A", ...base };
    expect(isDuplicatePair(a, b)).toBe(false);
  });
});

describe("duplicateGroups / duplicateIds", () => {
  const list = [
    { id: "1", number: "F-1", partyName: "A", ...base },
    { id: "2", number: "F-1", partyName: "A", ...base },
    { id: "3", number: "F-2", partyName: "A", ...base },
    { id: "4", number: "F-3", partyName: "B", ...base },
    { id: "5", number: "F-3", partyName: "B", ...base },
  ];
  it("trouve les groupes de doublons", () => {
    const groups = duplicateGroups(list);
    expect(groups).toHaveLength(2);
    expect(groups.every((g) => g.length === 2)).toBe(true);
  });
  it("liste les ids concernés", () => {
    expect(duplicateIds(list)).toEqual(new Set(["1", "2", "4", "5"]));
  });
});
