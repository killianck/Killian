// Détection d'un RELEVÉ DE FACTURATION (aussi appelé « récapitulatif », « bordereau »,
// « bilan des factures à payer »…) : un document qui ne facture rien lui-même mais
// LISTE plusieurs factures déjà émises, avec leur montant, et en donne le cumul.
//
// Objectif : ne pas compter deux fois une facture qui figure à la fois dans le
// logiciel (déposée seule) ET dans le détail d'un relevé. Le rapprochement (par
// numéro de facture) et la « compensation » se font ensuite dans
// src/lib/invoices/statements.ts.
//
// ⚠️ Prudence : en cas de doute, on NE déclare PAS un relevé (une facture normale
//    mal détectée en relevé serait exclue à tort du calcul de TVA). L'utilisateur
//    peut de toute façon corriger le classement à la main sur la fiche.

import { findMoneyTokens } from "./frenchNumbers";
// Import « tardif » (utilisé uniquement dans le corps des fonctions) : le cycle
// extract.ts <-> statement.ts est sans danger tant qu'aucun appel n'a lieu à
// l'initialisation du module.
import { datesInLine, deburr } from "./extract";

export type StatementLineParsed = {
  /** Numéro de la facture, tel qu'imprimé sur le relevé. */
  reference: string;
  /** Libellé de la ligne (chantier, désignation…), pour l'affichage. */
  label?: string;
  /** Date de la facture (ISO), si présente sur la ligne. */
  date?: string;
  /** Échéance de la ligne (ISO), si une colonne « échéance » est présente. */
  dueDate?: string;
  amountHT?: number;
  amountVAT?: number;
  amountTTC?: number;
};

export type StatementData = {
  lines: StatementLineParsed[];
  /** Totaux TELS QU'IMPRIMÉS sur le relevé (avant déduction des factures saisies). */
  grossHT?: number;
  grossVAT?: number;
  grossTTC?: number;
  /** Échéance commune (ISO), si toutes les lignes ont la même. */
  dueDate?: string;
  /** true = un mot-clé explicite (« relevé de facturation »…) a été trouvé. */
  keyworded: boolean;
  /** true = la somme des lignes correspond au total imprimé (à 1 % près). */
  sumMatchesTotal: boolean;
};

const KEYWORD =
  /(releve\s+de\s+factur|releve\s+mensuel|recapitulatif\s+(des\s+)?factur|bordereau\s+(de\s+)?factur|etat\s+(des\s+)?factur|situation\s+de\s+compte|liste\s+des\s+factur|decompte\s+(de\s+)?factur|factures?\s+(a\s+(payer|regler)|du\s+mois)|bilan\s+(des\s+)?factur)/;

/** Un jeton qui ressemble à un NUMÉRO de facture (≠ date, ≠ montant, ≠ mot). */
const REF_TOKEN = /^[A-Za-z]{0,4}\d[0-9A-Za-z/-]{2,17}$/;
/** Années nues (2020-2099) : à ne pas prendre pour une référence. */
const BARE_YEAR = /^20\d{2}$/;
/** Vrai si le jeton ressemble à une référence de facture (≥ 3 chiffres). */
function isRef(t: string): boolean {
  return REF_TOKEN.test(t) && (t.match(/\d/g)?.length ?? 0) >= 3 && !BARE_YEAR.test(t);
}

/** Retire d'une ligne les fragments de date pour ne pas les confondre avec une réf. */
function withoutDates(line: string): string {
  return line
    .replace(/\d{1,2}[/.\-]\d{1,2}[/.\-]\d{2,4}/g, " ")
    .replace(/\d{4}-\d{2}-\d{2}/g, " ");
}

type Row = StatementLineParsed & { amountTTC: number };

/** Tente de lire une ligne du tableau du relevé. */
function parseRow(line: string): Row | null {
  const money = findMoneyTokens(line);
  if (money.length === 0) return null;

  const dates = datesInLine(line);
  const bare = withoutDates(line);

  let reference: string | undefined;
  for (const tok of bare.split(/\s+/)) {
    const t = tok.replace(/[.,;:()]+$/g, "").replace(/^[.,;:()]+/g, "");
    if (isRef(t)) {
      reference = t;
      break;
    }
  }
  if (!reference) return null;

  // Montant de la ligne = dernier montant "raisonnable" (souvent le TTC, aligné
  // à droite). On écarte un éventuel montant nul de colonne "escompte/acompte",
  // mais on GARDE une ligne dont le seul montant est négatif (avoir / crédit
  // inclus dans le relevé) — l'ignorer ferait disparaître ce montant du calcul.
  const positive = money.filter((m) => m > 0);
  const negative = money.filter((m) => m < 0);
  if (!positive.length && !negative.length) return null;
  const amountTTC = positive.length ? positive[positive.length - 1] : negative[negative.length - 1];

  // Libellé : la ligne sans la référence, sans les dates, sans les montants,
  // sans les codes courts (n° de commande, « A1 », « 26LA1 »…).
  const label = bare
    .replace(reference, " ")
    .replace(/[0-9][0-9A-Za-z/\-]*/g, " ")
    .replace(/\b(lcr|directe|virement|cheque|traite|comptant|recu|eur|ttc|ht)\b/gi, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3)
    .join(" ")
    .trim();

  return {
    reference,
    label: label.length >= 3 ? label.slice(0, 80) : undefined,
    date: dates[0],
    dueDate: dates.length >= 2 ? dates[dates.length - 1] : undefined,
    amountTTC,
  };
}

/** Cherche « Tot. HT / TVA / TTC », « Cumul », « Net à payer »… dans le bas du relevé. */
function grossTotals(lines: string[]): { ht?: number; vat?: number; ttc?: number } {
  let ht: number | undefined;
  let vat: number | undefined;
  let ttc: number | undefined;
  for (const raw of lines) {
    const d = deburr(raw);
    const money = findMoneyTokens(raw);
    if (!money.length) continue;
    const last = money[money.length - 1];
    if (ttc === undefined && /(tot\.?|total|cumul|net)\s.*(ttc|t\.t\.c|a\s+payer)|montant\s+du|net\s+a\s+payer/.test(d)) {
      ttc = last;
    } else if (ht === undefined && /(tot\.?|total|cumul)\s.*h\.?t\b|total\s+hors\s+taxe/.test(d)) {
      ht = last;
    } else if (vat === undefined && /(tot\.?|total|cumul)\s.*t\.?v\.?a\b|montant\s+(de\s+)?(la\s+)?tva/.test(d)) {
      vat = last;
    }
  }
  return { ht, vat, ttc };
}

/**
 * Analyse le texte d'un document et, s'il s'agit d'un relevé de factures, renvoie
 * ses lignes + ses totaux. Sinon `null`.
 */
export function detectStatement(text: string): StatementData | null {
  const lines = text.split(/\r?\n/);
  const keyworded = KEYWORD.test(deburr(text.slice(0, 1200))) || KEYWORD.test(deburr(text));

  // Lignes candidates (réf + montant), dédoublonnées par référence.
  const seen = new Set<string>();
  const rows: Row[] = [];
  for (const line of lines) {
    const row = parseRow(line);
    if (!row) continue;
    const key = row.reference.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(row);
  }
  if (rows.length < 2) return null;

  const totals = grossTotals(lines);
  const sumRows = round2(rows.reduce((s, r) => s + r.amountTTC, 0));
  const grossTTC = totals.ttc;
  const sumMatchesTotal =
    grossTTC !== undefined && Math.abs(sumRows - grossTTC) <= Math.max(0.05, grossTTC * 0.01);

  // Décision (prudente) :
  //  - mot-clé explicite + au moins 2 lignes → relevé, SAUF si un total a bien
  //    été lu et qu'il ne recoupe PAS la somme des lignes (signe que ce n'est
  //    probablement pas un relevé, ou que la lecture est trop peu fiable) ;
  //  - pas de mot-clé : il faut ≥ 3 lignes ET une somme qui recoupe le total.
  const isStatement =
    (keyworded && rows.length >= 2 && (grossTTC === undefined || sumMatchesTotal)) ||
    (!keyworded && rows.length >= 3 && sumMatchesTotal);
  if (!isStatement) return null;

  // Échéance commune ?
  const dues = rows.map((r) => r.dueDate).filter((d): d is string => Boolean(d));
  const dueDate = dues.length === rows.length && new Set(dues).size === 1 ? dues[0] : undefined;

  // Si un seul taux et HT/TTC connus, on peut répartir le HT/TVA par ligne
  // (au prorata du TTC) — utile pour la compensation.
  const grossHT = totals.ht;
  const grossVAT = totals.vat ?? (grossHT !== undefined && grossTTC !== undefined ? round2(grossTTC - grossHT) : undefined);
  if (grossHT !== undefined && grossTTC && grossTTC > 0) {
    for (const r of rows) {
      r.amountHT = round2((r.amountTTC * grossHT) / grossTTC);
      if (grossVAT !== undefined) r.amountVAT = round2((r.amountTTC * grossVAT) / grossTTC);
    }
  }

  return {
    lines: rows.map((r) => ({
      reference: r.reference,
      label: r.label,
      date: r.date,
      dueDate: r.dueDate,
      amountHT: r.amountHT,
      amountVAT: r.amountVAT,
      amountTTC: r.amountTTC,
    })),
    grossHT,
    grossVAT,
    grossTTC,
    dueDate,
    keyworded,
    sumMatchesTotal,
  };
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
