// -----------------------------------------------------------------------------
// Lecture des paramètres de date venant de l'URL (filtres des écrans de liste).
//
// Ces valeurs arrivent d'un formulaire GET : elles se retrouvent donc dans l'URL,
// où elles peuvent être modifiées à la main, tronquées par un copier-coller, ou
// conservées dans un favori devenu périmé. Une valeur inexploitable ne doit
// JAMAIS produire une `Date` invalide : Prisma la refuse et l'écran entier tombe
// en erreur, au lieu d'ignorer simplement un filtre.
//
// Toutes les bornes sont calculées en UTC, comme les dates stockées en base
// (minuit UTC) et comme src/lib/invoices/filter.ts et src/lib/tva/aggregate.ts.
// -----------------------------------------------------------------------------

/** Année exploitable (1900-2999), sinon null. */
export function validYear(v: string | number | null | undefined): number | null {
  const n = typeof v === "number" ? v : Number(String(v ?? "").trim());
  if (!Number.isInteger(n) || n < 1900 || n > 2999) return null;
  return n;
}

/** Mois exploitable (1-12), sinon null. */
export function validMonth(v: string | number | null | undefined): number | null {
  const n = typeof v === "number" ? v : Number(String(v ?? "").trim());
  if (!Number.isInteger(n) || n < 1 || n > 12) return null;
  return n;
}

/**
 * Jour "AAAA-MM-JJ" saisi dans un champ `<input type="date">` -> minuit UTC.
 * Renvoie null si la valeur n'est pas une date réelle (« 2026-02-31 » comprise).
 */
export function parseDayParam(v: string | null | undefined): Date | null {
  const s = String(v ?? "").trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  // Rejette les dates « rattrapées » par JavaScript (31 février -> 3 mars).
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  if (validYear(y) === null) return null;
  return date;
}

/** Minuit UTC du jour d'une date (par défaut : aujourd'hui). */
export function utcDayStart(d: Date = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Le jour suivant, à minuit UTC — borne haute EXCLUSIVE d'un intervalle inclusif. */
export function nextUtcDay(d: Date): Date {
  return new Date(d.getTime() + 24 * 60 * 60 * 1000);
}
