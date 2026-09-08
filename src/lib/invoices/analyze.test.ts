import { describe, expect, it } from "vitest";
import { analysisMayWrite, analysisModeFlags, type AnalyzeMode } from "./analyze";
import { STATUSES } from "@/lib/domain/enums";

// Ces deux règles protègent la saisie de l'utilisateur. Un manquement ici s'est
// déjà traduit par une perte de données silencieuse : une facture corrigée à la
// main était remise à zéro (numéro, montants, dates, lignes de TVA) par une
// analyse automatique qui se terminait après coup.

describe("analysisMayWrite", () => {
  it("écrit tant que la facture est bien en cours d'analyse", () => {
    expect(analysisMayWrite("analyse_en_cours")).toBe(true);
  });

  it("n'écrit JAMAIS si un humain a fait passer la facture à un autre statut", () => {
    for (const statut of Object.keys(STATUSES).filter((s) => s !== "analyse_en_cours")) {
      expect(analysisMayWrite(statut)).toBe(false);
    }
  });

  it("n'écrit pas sur un statut inconnu (prudence par défaut)", () => {
    expect(analysisMayWrite("")).toBe(false);
    expect(analysisMayWrite("nimporte_quoi")).toBe(false);
  });
});

describe("analysisModeFlags", () => {
  it("seul un premier import repart d'une page blanche", () => {
    expect(analysisModeFlags("import").keepExisting).toBe(false);
  });

  it("une analyse reprise après interruption préserve l'existant", () => {
    // On ignore alors s'il s'agissait d'un import ou d'une ré-analyse : préserver
    // est le seul choix qui ne détruit rien.
    expect(analysisModeFlags("resume").keepExisting).toBe(true);
  });

  it("une ré-analyse demandée préserve l'existant et journalise", () => {
    expect(analysisModeFlags("reanalyze")).toEqual({ keepExisting: true, journal: true });
  });

  it("seule une ré-analyse demandée par l'utilisateur alimente le journal", () => {
    for (const mode of ["import", "resume"] as AnalyzeMode[]) {
      expect(analysisModeFlags(mode).journal).toBe(false);
    }
  });
});
