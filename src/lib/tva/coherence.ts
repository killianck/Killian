// Contrôles mathématiques des montants d'une facture.
// On ne fait JAMAIS confiance aveuglément aux données extraites automatiquement.

import type { CoherenceLevel } from "@/lib/domain/enums";
import { isKnownVatRate, KNOWN_VAT_RATES, round2 } from "./rules";

export type VatLineInput = {
  rate: number;
  baseHT: number;
  vatAmount: number;
};

export type InvoiceAmountsInput = {
  totalHT: number;
  totalVAT: number;
  totalTTC: number;
  vatLines: VatLineInput[];
  /** Type de document : un avoir peut légitimement porter des montants négatifs. */
  documentType?: "facture" | "avoir";
  /** Dates ISO (AAAA-MM-JJ) : contrôle échéance ≥ date de facture. */
  invoiceDate?: string;
  dueDate?: string;
};

export type CoherenceIssue = {
  severity: "warning" | "error";
  message: string;
};

export type CoherenceReport = {
  level: CoherenceLevel;
  issues: CoherenceIssue[];
};

// Tolérance d'arrondi de base : 2 centimes.
const TOL = 0.02;
/** Tolérance en euros proportionnelle au montant : ~0,1 % (arrondis multi-lignes). */
const rel = (amount: number) => Math.max(TOL, Math.abs(amount) * 0.001);

/**
 * Vérifie la cohérence des montants.
 * Exemple : HT + TVA doit être égal à TTC (à quelques centimes près).
 */
export function checkCoherence(input: InvoiceAmountsInput): CoherenceReport {
  const issues: CoherenceIssue[] = [];
  const { totalHT, totalVAT, totalTTC, vatLines } = input;
  const isAvoir = input.documentType === "avoir";

  // 1) HT + TVA = TTC
  const expectedTTC = round2(totalHT + totalVAT);
  if (Math.abs(expectedTTC - totalTTC) > TOL) {
    issues.push({
      severity: "error",
      message: `HT (${totalHT}) + TVA (${totalVAT}) = ${expectedTTC}, mais le total TTC indiqué est ${totalTTC}.`,
    });
  }

  // 2) Signe des montants
  if (totalVAT < 0 && !isAvoir) {
    issues.push({
      severity: "error",
      message: "Le montant de TVA est négatif : lecture ou saisie probablement erronée.",
    });
  }
  if ((totalHT < 0 || totalTTC < 0) && !isAvoir) {
    issues.push({
      severity: "error",
      message: "Un montant total est négatif alors que ce document n'est pas un avoir.",
    });
  }
  if ((totalHT < 0 || totalVAT < 0 || totalTTC < 0) && isAvoir) {
    issues.push({
      severity: "warning",
      message: "Avoir : saisissez les montants en valeur POSITIVE (le signe est appliqué au calcul de TVA).",
    });
  }

  // 3) TVA ne peut pas dépasser le TTC ; HT ne peut pas dépasser le TTC
  const absHT = Math.abs(totalHT);
  const absVAT = Math.abs(totalVAT);
  const absTTC = Math.abs(totalTTC);
  if (absVAT > absTTC + TOL) {
    issues.push({ severity: "error", message: "Le montant de TVA dépasse le total TTC." });
  }
  if (absHT > absTTC + TOL) {
    issues.push({ severity: "error", message: "Le total HT dépasse le total TTC." });
  }

  // 4) Échéance ≥ date de facture
  if (input.invoiceDate && input.dueDate && input.dueDate < input.invoiceDate) {
    issues.push({ severity: "warning", message: "La date d'échéance précède la date de facture." });
  }

  if (vatLines.length > 0) {
    // 5) Somme des lignes = totaux (tolérance quasi constante).
    const sumBase = round2(vatLines.reduce((s, l) => s + l.baseHT, 0));
    const sumVat = round2(vatLines.reduce((s, l) => s + l.vatAmount, 0));
    const lineTol = Math.max(TOL, 0.005 * vatLines.length);

    if (Math.abs(sumBase - totalHT) > lineTol) {
      issues.push({
        severity: "warning",
        message: `La somme des bases HT par taux (${sumBase}) ne correspond pas au total HT (${totalHT}).`,
      });
    }
    if (Math.abs(sumVat - totalVAT) > lineTol) {
      issues.push({
        severity: "warning",
        message: `La somme des TVA par taux (${sumVat}) ne correspond pas au total TVA (${totalVAT}).`,
      });
    }

    // 6) Pour chaque ligne : TVA ≈ baseHT * taux / 100 (tolérance ~0,1 %).
    for (const l of vatLines) {
      const expected = round2((l.baseHT * l.rate) / 100);
      if (Math.abs(expected - l.vatAmount) > rel(expected)) {
        issues.push({
          severity: "warning",
          message: `Ligne ${l.rate} % : ${l.baseHT} × ${l.rate} % = ${expected}, mais la TVA indiquée est ${l.vatAmount}.`,
        });
      }
      if (!isKnownVatRate(l.rate)) {
        issues.push({
          severity: "warning",
          message: `Le taux ${l.rate} % n'est pas un taux français standard : à vérifier.`,
        });
      }
    }
  } else if (absHT > 0 && absVAT > 0) {
    // 7) Pas de détail par taux : le taux global implicite doit produire une
    //    TVA proche (borne EN EUROS, pas en points), et 0 % n'est pas un repère.
    const positiveRates = KNOWN_VAT_RATES.filter((r) => r > 0);
    const near = positiveRates.some(
      (r) => Math.abs(absVAT - round2((absHT * r) / 100)) <= rel(absHT),
    );
    if (!near) {
      const impliedRate = round2((absVAT / absHT) * 100);
      issues.push({
        severity: Math.abs(absVAT - round2((absHT * 20) / 100)) > absHT * 0.01 ? "error" : "warning",
        message: `Le taux de TVA global implicite (${impliedRate} %) ne correspond à aucun taux standard : à vérifier.`,
      });
    }
  }

  const hasError = issues.some((i) => i.severity === "error");
  const hasWarning = issues.some((i) => i.severity === "warning");
  const level: CoherenceLevel = hasError ? "incoherent" : hasWarning ? "a_verifier" : "coherent";

  return { level, issues };
}
