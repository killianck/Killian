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

const SPACES = /[\s   ]/g;

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

/** Montants « monétaires » (2 décimales) présents dans une ligne de texte. */
export function findMoneyTokens(line: string): number[] {
  const out: number[] = [];
  const re = /-?\d[\d\s  .]*[.,]\d{2}(?!\d)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    const v = parseFrAmount(m[0]);
    if (v === null) continue;
    // ignore un petit nombre suivi de « % » (c'est un taux, pas un montant)
    if (Math.abs(v) <= 30 && /^\s*%/.test(line.slice(m.index + m[0].length))) continue;
    out.push(v);
  }
  return out;
}
