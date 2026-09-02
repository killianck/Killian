// Détection de doublons de factures.
//
// Règle : deux factures sont un doublon probable si
//   - même numéro (non vide) ET même tiers (fournisseur / client), OU
//   - pas de numéro, mais même tiers + même date + même montant TTC.
//
// C'est une aide : l'utilisateur reste seul juge (deux vraies factures peuvent
// exceptionnellement se ressembler).

export type DuplicateCandidate = {
  id: string;
  number: string | null;
  partyName: string | null;
  invoiceDate: Date | string;
  totalTTC: number;
};

const norm = (s: string | null | undefined) =>
  (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");

const dayKey = (d: Date | string) => new Date(d).toISOString().slice(0, 10);

/** Clé de regroupement, ou null si la facture n'a pas assez d'infos. */
export function duplicateKey(inv: DuplicateCandidate): string | null {
  const party = norm(inv.partyName);
  const number = norm(inv.number);
  if (number && party) return `n:${number}|${party}`;
  if (!number && party && inv.totalTTC) return `m:${party}|${dayKey(inv.invoiceDate)}|${inv.totalTTC.toFixed(2)}`;
  return null;
}

/** Vrai si `a` et `b` sont un doublon probable (ids différents). */
export function isDuplicatePair(a: DuplicateCandidate, b: DuplicateCandidate): boolean {
  if (a.id === b.id) return false;
  const ka = duplicateKey(a);
  return ka !== null && ka === duplicateKey(b);
}

/** Groupes de doublons dans une liste (chaque groupe a au moins 2 factures). */
export function duplicateGroups<T extends DuplicateCandidate>(invoices: T[]): T[][] {
  const map = new Map<string, T[]>();
  for (const inv of invoices) {
    const key = duplicateKey(inv);
    if (!key) continue;
    (map.get(key) ?? map.set(key, []).get(key)!).push(inv);
  }
  return [...map.values()].filter((g) => g.length > 1);
}

/** Les ids concernés par un doublon, à plat. */
export function duplicateIds<T extends DuplicateCandidate>(invoices: T[]): Set<string> {
  const ids = new Set<string>();
  for (const group of duplicateGroups(invoices)) {
    for (const inv of group) ids.add(inv.id);
  }
  return ids;
}
