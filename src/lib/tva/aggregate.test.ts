import { describe, expect, it } from "vitest";
import {
  monthlyBreakdown,
  sumInvoices,
  totalsForMonth,
  totalsForYear,
  type AggregatableInvoice,
} from "./aggregate";

const sample: AggregatableInvoice[] = [
  // Ventes (TVA collectée)
  { invoiceDate: "2026-01-15", direction: "vente", documentType: "facture", totalHT: 1000, totalVAT: 200, totalTTC: 1200 },
  { invoiceDate: "2026-01-20", direction: "vente", documentType: "facture", totalHT: 500, totalVAT: 27.5, totalTTC: 527.5 },
  // Achats (TVA déductible)
  { invoiceDate: "2026-01-10", direction: "achat", documentType: "facture", totalHT: 300, totalVAT: 60, totalTTC: 360 },
  { invoiceDate: "2026-02-05", direction: "achat", documentType: "facture", totalHT: 200, totalVAT: 40, totalTTC: 240 },
  // Avoir client (réduit la TVA collectée)
  { invoiceDate: "2026-02-12", direction: "vente", documentType: "avoir", totalHT: 100, totalVAT: 20, totalTTC: 120 },
];

describe("sumInvoices", () => {
  it("sépare TVA collectée et déductible", () => {
    const t = sumInvoices(sample);
    expect(t.collectedVat).toBe(207.5); // 200 + 27.5 - 20 (avoir)
    expect(t.deductibleVat).toBe(100); // 60 + 40
    expect(t.netVat).toBe(107.5);
    expect(t.count).toBe(5);
  });

  it("un avoir vient en déduction du total HT/TTC", () => {
    const t = sumInvoices([
      { invoiceDate: "2026-03-01", direction: "vente", documentType: "facture", totalHT: 1000, totalVAT: 200, totalTTC: 1200 },
      { invoiceDate: "2026-03-02", direction: "vente", documentType: "avoir", totalHT: 250, totalVAT: 50, totalTTC: 300 },
    ]);
    expect(t.totalHT).toBe(750);
    expect(t.totalTTC).toBe(900);
    expect(t.collectedVat).toBe(150);
  });
});

describe("totalsForMonth / totalsForYear", () => {
  it("filtre correctement janvier 2026", () => {
    const t = totalsForMonth(sample, 2026, 1);
    expect(t.count).toBe(3);
    expect(t.collectedVat).toBe(227.5);
    expect(t.deductibleVat).toBe(60);
    expect(t.netVat).toBe(167.5);
  });

  it("filtre correctement février 2026", () => {
    const t = totalsForMonth(sample, 2026, 2);
    expect(t.count).toBe(2);
    expect(t.deductibleVat).toBe(40);
    expect(t.collectedVat).toBe(-20); // uniquement l'avoir
  });

  it("totalise l'année", () => {
    const t = totalsForYear(sample, 2026);
    expect(t.count).toBe(5);
    expect(t.netVat).toBe(107.5);
  });

  it("renvoie 0 pour une année sans facture", () => {
    const t = totalsForYear(sample, 2025);
    expect(t.count).toBe(0);
    expect(t.netVat).toBe(0);
  });
});

describe("robustesse", () => {
  it("ignore une facture non datée sans fausser le total (excludedCount)", () => {
    const t = sumInvoices([
      { invoiceDate: "2026-03-01", direction: "vente", documentType: "facture", totalHT: 1000, totalVAT: 200, totalTTC: 1200 },
      { invoiceDate: "pas une date", direction: "vente", documentType: "facture", totalHT: 999, totalVAT: 99, totalTTC: 1098 },
    ]);
    expect(t.count).toBe(1);
    expect(t.excludedCount).toBe(1);
    expect(t.collectedVat).toBe(200);
  });

  it("ignore une direction aberrante plutôt que de la compter comme un achat", () => {
    const t = sumInvoices([
      { invoiceDate: "2026-03-01", direction: "Vente ", documentType: "facture", totalHT: 1000, totalVAT: 200, totalTTC: 1200 },
    ]);
    expect(t.count).toBe(0);
    expect(t.excludedCount).toBe(1);
  });
});

describe("monthlyBreakdown", () => {
  it("renvoie 12 mois", () => {
    const months = monthlyBreakdown(sample, 2026);
    expect(months).toHaveLength(12);
    expect(months[0].count).toBe(3); // janvier
    expect(months[1].count).toBe(2); // février
    expect(months[5].count).toBe(0); // juin
  });

  it("la somme des mois = total annuel", () => {
    const months = monthlyBreakdown(sample, 2026);
    const sumNet = months.reduce((s, m) => s + m.netVat, 0);
    expect(Math.round(sumNet * 100) / 100).toBe(totalsForYear(sample, 2026).netVat);
  });
});

describe("détection des totaux incohérents (garde-fou déclaration TVA)", () => {
  const inv = (ht: number, vat: number, ttc: number) => ({
    invoiceDate: "2026-03-10",
    direction: "achat" as const,
    documentType: "facture" as const,
    totalHT: ht,
    totalVAT: vat,
    totalTTC: ttc,
  });

  it("ne signale rien quand tout est cohérent", () => {
    const t = sumInvoices([inv(100, 20, 120), inv(50, 10, 60)]);
    expect(t.incoherentCount).toBe(0);
    expect(t.gap).toBe(0);
    expect(t.totalVAT).toBe(30);
  });

  it("repère une facture dont seul le TTC a été lu (HT resté à 0)", () => {
    // Cas réel : l'extraction ne retrouve que « Net à payer » -> HT et TVA à 0.
    const t = sumInvoices([inv(100, 20, 120), inv(0, 0, 500)]);
    expect(t.incoherentCount).toBe(1);
    expect(t.gap).toBe(500); // 620 TTC - 100 HT - 20 TVA
    expect(t.totalTTC).toBe(620);
  });

  it("l'écart global correspond à la somme des montants orphelins", () => {
    const t = sumInvoices([inv(0, 0, 1000), inv(0, 0, 500), inv(200, 40, 240)]);
    expect(t.incoherentCount).toBe(2);
    expect(t.gap).toBe(1500);
  });

  it("ignore une facture entièrement vide (pas encore analysée)", () => {
    const t = sumInvoices([inv(0, 0, 0), inv(100, 20, 120)]);
    expect(t.incoherentCount).toBe(0);
    expect(t.gap).toBe(0);
  });

  it("tolère les arrondis au centime", () => {
    const t = sumInvoices([inv(100, 20.004, 120.01)]);
    expect(t.incoherentCount).toBe(0);
  });
});

describe("devises étrangères — jamais additionnées aux euros", () => {
  const inv = (ttc: number, currency?: string) => ({
    invoiceDate: "2026-03-10",
    direction: "achat" as const,
    documentType: "facture" as const,
    totalHT: ttc / 1.2,
    totalVAT: ttc - ttc / 1.2,
    totalTTC: ttc,
    currency,
  });

  it("exclut une facture en USD des totaux et la signale", () => {
    const t = sumInvoices([inv(120, "EUR"), inv(1000, "USD")]);
    expect(t.count).toBe(1);
    expect(t.totalTTC).toBe(120); // et surtout PAS 1120
    expect(t.foreignCurrencyCount).toBe(1);
    expect(t.foreignCurrencies).toEqual(["USD"]);
  });

  it("traite une devise absente ou vide comme des euros (cas normal)", () => {
    const t = sumInvoices([inv(120), inv(240, ""), inv(60, "eur")]);
    expect(t.count).toBe(3);
    expect(t.totalTTC).toBe(420);
    expect(t.foreignCurrencyCount).toBe(0);
  });

  it("liste chaque devise étrangère une seule fois", () => {
    const t = sumInvoices([inv(10, "USD"), inv(20, "USD"), inv(30, "CHF")]);
    expect(t.foreignCurrencyCount).toBe(3);
    expect(t.foreignCurrencies.sort()).toEqual(["CHF", "USD"]);
    expect(t.totalTTC).toBe(0);
  });
});
