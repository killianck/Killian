import { describe, expect, it } from "vitest";
import { buildDueRange } from "./dueFilter";

const base = { period: "", year: "", from: "", to: "" };
// Point de référence fixe : mardi 8 septembre 2026.
const today = new Date(Date.UTC(2026, 8, 8));
const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));

/** Une échéance tombant ce jour-là est-elle affichée ? */
function inclut(r: { gte?: Date; lt?: Date }, jour: Date): boolean {
  return (!r.gte || jour >= r.gte) && (!r.lt || jour < r.lt);
}

describe("buildDueRange — période personnalisée", () => {
  it("INCLUT le dernier jour de la période (bug : le 31 disparaissait)", () => {
    const r = buildDueRange({ ...base, period: "perso", from: "2026-01-01", to: "2026-01-31" }, today);
    expect(inclut(r, utc(2026, 1, 1))).toBe(true);
    expect(inclut(r, utc(2026, 1, 31))).toBe(true);
    expect(inclut(r, utc(2026, 2, 1))).toBe(false);
  });

  it("une seule journée : du 15 au 15 affiche le 15", () => {
    const r = buildDueRange({ ...base, period: "perso", from: "2026-05-15", to: "2026-05-15" }, today);
    expect(inclut(r, utc(2026, 5, 15))).toBe(true);
    expect(inclut(r, utc(2026, 5, 14))).toBe(false);
    expect(inclut(r, utc(2026, 5, 16))).toBe(false);
  });

  it("bornes inversées : la période est remise dans l'ordre", () => {
    const r = buildDueRange({ ...base, period: "perso", from: "2026-03-31", to: "2026-03-01" }, today);
    expect(inclut(r, utc(2026, 3, 1))).toBe(true);
    expect(inclut(r, utc(2026, 3, 31))).toBe(true);
  });

  it("une seule borne saisie laisse l'autre côté ouvert", () => {
    const depuis = buildDueRange({ ...base, period: "perso", from: "2026-06-01", to: "" }, today);
    expect(depuis.lt).toBeUndefined();
    expect(inclut(depuis, utc(2030, 1, 1))).toBe(true);

    const jusqua = buildDueRange({ ...base, period: "perso", from: "", to: "2026-06-30" }, today);
    expect(jusqua.gte).toBeUndefined();
    expect(inclut(jusqua, utc(2026, 6, 30))).toBe(true);
    expect(inclut(jusqua, utc(2026, 7, 1))).toBe(false);
  });
});

describe("buildDueRange — périodes prédéfinies (en UTC)", () => {
  it("mois en cours : du 1er au dernier jour du mois", () => {
    const r = buildDueRange({ ...base, period: "mois" }, today);
    expect(r.gte).toEqual(utc(2026, 9, 1));
    expect(inclut(r, utc(2026, 9, 30))).toBe(true);
    expect(inclut(r, utc(2026, 8, 31))).toBe(false);
    expect(inclut(r, utc(2026, 10, 1))).toBe(false);
  });

  it("mois suivant", () => {
    const r = buildDueRange({ ...base, period: "mois_suivant" }, today);
    expect(inclut(r, utc(2026, 10, 1))).toBe(true);
    expect(inclut(r, utc(2026, 10, 31))).toBe(true);
    expect(inclut(r, utc(2026, 9, 30))).toBe(false);
  });

  it("décembre : le mois suivant bascule sur l'année d'après", () => {
    const r = buildDueRange({ ...base, period: "mois_suivant" }, new Date(Date.UTC(2026, 11, 15)));
    expect(inclut(r, utc(2027, 1, 15))).toBe(true);
  });

  it("année choisie", () => {
    const r = buildDueRange({ ...base, period: "annee", year: "2025" }, today);
    expect(inclut(r, utc(2025, 1, 1))).toBe(true);
    expect(inclut(r, utc(2025, 12, 31))).toBe(true);
    expect(inclut(r, utc(2026, 1, 1))).toBe(false);
  });

  it("« à venir » part d'aujourd'hui inclus", () => {
    const r = buildDueRange({ ...base, period: "avenir" }, today);
    expect(inclut(r, utc(2026, 9, 8))).toBe(true);
    expect(inclut(r, utc(2026, 9, 7))).toBe(false);
    expect(r.lt).toBeUndefined();
  });
});

describe("buildDueRange — paramètres d'URL inexploitables", () => {
  // Sans garde-fou, ces valeurs produisaient une Date invalide -> l'écran
  // entier tombait en erreur (PrismaClientValidationError).
  const invalides = ["pas-une-date", "1e999", "2026-02-31", "0000-00-00", "2026/01/01", "", "  "];

  for (const v of invalides) {
    it(`from="${v}" ne produit jamais de date invalide`, () => {
      const r = buildDueRange({ ...base, period: "perso", from: v, to: "2026-12-31" }, today);
      for (const b of [r.gte, r.lt]) {
        if (b) expect(Number.isNaN(b.getTime())).toBe(false);
      }
    });
  }

  it("année non numérique -> année en cours", () => {
    const r = buildDueRange({ ...base, period: "annee", year: "abc" }, today);
    expect(r.gte).toEqual(utc(2026, 1, 1));
  });

  it("année démesurée -> année en cours", () => {
    const r = buildDueRange({ ...base, period: "annee", year: "1e999" }, today);
    expect(r.gte).toEqual(utc(2026, 1, 1));
    expect(Number.isNaN(r.lt!.getTime())).toBe(false);
  });

  it("période inconnue -> « à venir »", () => {
    const r = buildDueRange({ ...base, period: "n'importe quoi" }, today);
    expect(r.gte).toEqual(utc(2026, 9, 8));
  });
});
