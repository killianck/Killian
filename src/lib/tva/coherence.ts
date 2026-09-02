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
};

export type CoherenceIssue = {
  severity: "warning" | "error";
  message: string;
};

export type CoherenceReport = {
  level: CoherenceLevel;
  issues: CoherenceIssue[];
};

// Tolérance d'arrondi : 2 centimes pour les totaux, un peu plus pour la somme des lignes.
const TOL = 0.02;

/**
 * Vérifie la cohérence des montants.
 * Exemple : HT + TVA doit être égal à TTC (à quelques centimes près).
 */
export function checkCoherence(input: InvoiceAmountsInput): CoherenceReport {
  const issues: CoherenceIssue[] = [];
  const { totalHT, totalVAT, totalTTC, vatLines } = input;

  // 1) HT + TVA = TTC
  const expectedTTC = round2(totalHT + totalVAT);
  if (Math.abs(expectedTTC - totalTTC) > TOL) {
    issues.push({
      severity: "error",
      message: `HT (${totalHT}) + TVA (${totalVAT}) = ${expectedTTC}, mais le total TTC indiqué est ${totalTTC}.`,
    });
  }

  // 2) Montants négatifs inattendus
  if (totalHT < 0 || totalTTC < 0) {
    issues.push({
      severity: "warning",
      message: "Un montant total est négatif (normal seulement pour un avoir).",
    });
  }

  if (vatLines.length > 0) {
    // 3) Somme des lignes = totaux
    const sumBase = round2(vatLines.reduce((s, l) => s + l.baseHT, 0));
    const sumVat = round2(vatLines.reduce((s, l) => s + l.vatAmount, 0));

    if (Math.abs(sumBase - totalHT) > TOL * vatLines.length + TOL) {
      issues.push({
        severity: "warning",
        message: `La somme des bases HT par taux (${sumBase}) ne correspond pas au total HT (${totalHT}).`,
      });
    }
    if (Math.abs(sumVat - totalVAT) > TOL * vatLines.length + TOL) {
      issues.push({
        severity: "warning",
        message: `La somme des TVA par taux (${sumVat}) ne correspond pas au total TVA (${totalVAT}).`,
      });
    }

    // 4) Pour chaque ligne : TVA ≈ baseHT * taux / 100
    for (const l of vatLines) {
      const expected = round2((l.baseHT * l.rate) / 100);
      if (Math.abs(expected - l.vatAmount) > Math.max(TOL, Math.abs(expected) * 0.01)) {
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
  } else if (totalHT > 0 && totalVAT > 0) {
    // 5) Pas de détail par taux : on vérifie un taux global plausible.
    //    Tolérance de 0,5 point pour absorber les arrondis (fréquents sur les
    //    factures télécom, énergie, etc.).
    const impliedRate = round2((totalVAT / totalHT) * 100);
    const nearStandard = KNOWN_VAT_RATES.some((r) => Math.abs(r - impliedRate) <= 0.5);
    if (!nearStandard) {
      issues.push({
        severity: "warning",
        message: `Le taux de TVA global implicite (${impliedRate} %) n'est pas un taux standard : à vérifier.`,
      });
    }
  }

  const hasError = issues.some((i) => i.severity === "error");
  const hasWarning = issues.some((i) => i.severity === "warning");
  const level: CoherenceLevel = hasError ? "incoherent" : hasWarning ? "a_verifier" : "coherent";

  return { level, issues };
}
