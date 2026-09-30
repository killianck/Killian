// Lecture des nombres tels qu'ils apparaissent sur les factures françaises
// (et quelques variantes anglo-saxonnes), avec séparateurs ambigus.
//
// Exemples gérés :
//   "1 234,56 €"  -> 1234.56
//   "1.234,56"    -> 1234.56
//   "1,234.56"    -> 1234.56   (format anglais parfois présent)
//   "1234.56"     -> 1234.56
//   "1.234"       -> 1234      (point = séparateur de milliers)
//   "20,00 %"     -> 20
//   "-49,90"      -> -49.9

const SPACES = /[\s   ]/g;

export function parseFrAmount(raw: string | number | null | undefined): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (!raw) return null;

  let s = String(raw).replace(SPACES, "");
  s = s.replace(/[^\d.,\-]/g, ""); // ne garde que chiffres, séparateurs et signe
  if (!/\d/.test(s)) return null;

  const neg = s.startsWith("-");
  s = s.replace(/-/g, "");

  const commas = (s.match(/,/g) ?? []).length;
  const dots = (s.match(/\./g) ?? []).length;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");

  let decimalSep = "";
  if (commas > 0 && dots > 0) {
    decimalSep = lastComma > lastDot ? "," : ".";
  } else if (commas === 1) {
    const after = s.length - lastComma - 1;
    // "1,234" = milliers ; "12,5" ou "12,50" = décimale
    decimalSep = after === 3 && /^\d{1,3},\d{3}$/.test(s) ? "" : after <= 2 ? "," : "";
  } else if (dots === 1) {
    const after = s.length - lastDot - 1;
    decimalSep = after === 3 && /^\d{1,3}\.\d{3}$/.test(s) ? "" : after <= 2 ? "." : "";
  }
  // (plusieurs virgules ou plusieurs points sans mélange => tous séparateurs de milliers)

  let intPart = s;
  let fracPart = "";
  if (decimalSep) {
    const idx = s.lastIndexOf(decimalSep);
    intPart = s.slice(0, idx);
    fracPart = s.slice(idx + 1);
  }
  intPart = intPart.replace(/[.,]/g, "");

  const n = Number(`${intPart || "0"}${fracPart ? "." + fracPart : ""}`);
  if (!Number.isFinite(n)) return null;
  return neg ? -n : n;
}

// Un « montant » = nombre avec EXACTEMENT 2 décimales. Les groupes de milliers
// doivent faire exactement 3 chiffres : ainsi « 1  2 500,00 » (quantité 1 collée
// au prix par la mise en page / l'OCR) ne se lit PAS « 12 500,00 » — seul
// « 2 500,00 » est capturé. Formats gérés :
//   12,500.00        (anglo, virgule = milliers)
//   1.234,56         (européen, point = milliers)
//   2 500,00 / 12,50 (espace = milliers, groupes de 3 exacts)
//   1234.56 / 40,00  (sans séparateur de milliers)
const SP = "[ \\u00a0\\u202f\\u2007]";
const MONEY_RE = new RegExp(
  "(?<![\\p{L}\\d.,])-?(?:" +
    `\\d{1,3}(?:,\\d{3})+\\.\\d{2}` + // 12,500.00
    `|\\d{1,3}(?:\\.\\d{3})+,\\d{2}` + // 1.234,56
    `|\\d{1,3}(?:${SP}\\d{3})+[.,]\\d{2}` + // 2 500,00  (≥ 1 groupe d'espace)
    `|\\d+[.,]\\d{2}` + // 12,50 / 1234.56 / 40,00
    ")(?!\\d)",
  "gu",
);

/** Montants « monétaires » (2 décimales) présents dans une ligne de texte. */
export function findMoneyTokens(line: string): number[] {
  const out: number[] = [];
  MONEY_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = MONEY_RE.exec(line))) {
    const v = parseFrAmount(m[0]);
    if (v === null) continue;
    // Ignore un petit nombre collé à « % » : c'est un taux, pas un montant
    // (« 20,00 % » ne doit jamais compter comme 20 €).
    //
    // ⚠️ Côté « avant » (un « % » précède immédiatement ce nombre), on exige
    // qu'il n'y ait STRICTEMENT AUCUN espace entre les deux — un taux vraiment
    // « collé » façon OCR/mise en page dégradée (« 444,90%20.00 », voir test
    // ci-dessous). Un espace, même un seul, signale une colonne différente,
    // pas une décoration du taux : trouvé en reproduisant une vraie erreur sur
    // un ticket de caisse (Castorama) dont la ligne de récap TVA est
    // « V5 TVA 20,00% 17,49 3,50 20,99 » (Total HT / Montant TVA / Total TTC).
    // L'ancien test (avec `\s*`, espace optionnel) excluait alors 17,49 — le
    // Total HT, séparé du taux par un simple espace de colonne — cassant
    // l'appariement HT/TVA cohérent et faisant retomber la TVA lue sur 20,99
    // (le TTC) au lieu de 3,50.
    if (Math.abs(v) <= 30) {
      const after = line.slice(m.index + m[0].length);
      const before = line.slice(0, m.index);
      if (/^\s*%/.test(after) || /%$/.test(before)) continue;
    }
    out.push(v);
  }
  return out;
}
