// Calcul des totaux d'une facture à partir de ses lignes de TVA.

import { round2 } from "./rules";

export type LineInput = { rate: number; baseHT: number; vatAmount: number };

export type Totals = { totalHT: number; totalVAT: number; totalTTC: number };

/** Somme des lignes -> totaux HT / TVA / TTC (arrondis au centime). */
export function totalsFromLines(lines: LineInput[]): Totals {
  const totalHT = round2(lines.reduce((s, l) => s + (Number(l.baseHT) || 0), 0));
  const totalVAT = round2(lines.reduce((s, l) => s + (Number(l.vatAmount) || 0), 0));
  return { totalHT, totalVAT, totalTTC: round2(totalHT + totalVAT) };
}

/** TVA théorique d'une ligne : base HT × taux. */
export function vatOfLine(baseHT: number, rate: number): number {
  return round2(((Number(baseHT) || 0) * (Number(rate) || 0)) / 100);
}
