// Formatage à la française : dates JJ/MM/AAAA et montants "1 250,00 €".

const EUR = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const NUM = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** "1 250,00 €" (devise EUR par défaut). */
export function formatMoney(value: number | null | undefined, currency = "EUR"): string {
  const n = typeof value === "number" && Number.isFinite(value) ? value : 0;
  if (currency === "EUR") return EUR.format(n);
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(n);
}

/** "1 250,00" sans symbole. */
export function formatNumber(value: number | null | undefined): string {
  return NUM.format(typeof value === "number" && Number.isFinite(value) ? value : 0);
}

/** "20 %", "5,5 %". */
export function formatRate(rate: number | null | undefined): string {
  const n = typeof rate === "number" && Number.isFinite(rate) ? rate : 0;
  return `${NUM.format(n).replace(/,00$/, "").replace(/(,\d)0$/, "$1")} %`;
}

/** "02/09/2026". Accepte Date, chaîne ISO, ou null. */
export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

/** Libellé de mois français : "Septembre 2026". */
export function formatMonthLabel(year: number, month1to12: number): string {
  const d = new Date(year, month1to12 - 1, 1);
  const s = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const MONTH_NAMES_FR = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

/** Décale un couple (année, mois 1-12) de `delta` mois. */
export function addMonths(year: number, month1to12: number, delta: number): { year: number; month: number } {
  const zero = year * 12 + (month1to12 - 1) + delta;
  return { year: Math.floor(zero / 12), month: (((zero % 12) + 12) % 12) + 1 };
}

/** Date -> "AAAA-MM-JJ" pour un <input type="date">. "" si absente. */
export function toDateInputValue(value: Date | string | null | undefined): string {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Convertit une saisie texte "1 250,50" ou "1250.5" en nombre. */
export function parseAmount(input: string | number | null | undefined): number {
  if (typeof input === "number") return input;
  if (!input) return 0;
  const cleaned = String(input)
    .replace(/\s/g, "")
    .replace(/ /g, "")
    .replace(/€/g, "")
    .replace(",", ".");
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}
