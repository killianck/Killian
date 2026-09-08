// Construction du filtre Prisma de l'écran « Échéances ».
// Isolé ici pour pouvoir être testé (comme src/lib/invoices/filter.ts).

import { nextUtcDay, parseDayParam, utcDayStart, validYear } from "@/lib/domain/dateParams";

export type DuePeriod = "avenir" | "mois" | "mois_suivant" | "annee" | "perso";

export type DueRangeParams = {
  period: string;
  year: string;
  from: string;
  to: string;
};

/** Bornes de la période : `gte` incluse, `lt` exclue (absente = pas de limite haute). */
export type DueRange = { gte?: Date; lt?: Date };

/**
 * Traduit les filtres de l'écran en intervalle de dates d'échéance.
 *
 * Deux règles importantes :
 *  - tout est calculé en UTC, comme les dates stockées (minuit UTC) ;
 *  - « du … au … » est INCLUSIF des deux côtés : une facture qui échoit le
 *    dernier jour de la période doit apparaître (la borne `lt` est donc le
 *    lendemain de `to`, pas `to` lui-même).
 *
 * Les valeurs inexploitables sont ignorées au lieu de produire une date invalide
 * qui ferait échouer la requête (cf. src/lib/domain/dateParams.ts).
 *
 * @param today  point de référence — injectable pour les tests.
 */
export function buildDueRange(p: DueRangeParams, today: Date = new Date()): DueRange {
  const start = utcDayStart(today);
  const y = start.getUTCFullYear();
  const m = start.getUTCMonth();
  const utc = (yy: number, mm: number) => new Date(Date.UTC(yy, mm, 1));

  switch (p.period) {
    case "mois":
      return { gte: utc(y, m), lt: utc(y, m + 1) };

    case "mois_suivant":
      return { gte: utc(y, m + 1), lt: utc(y, m + 2) };

    case "annee": {
      const yy = validYear(p.year) ?? y;
      return { gte: utc(yy, 0), lt: utc(yy + 1, 0) };
    }

    case "perso": {
      // Une borne absente ou illisible = pas de limite de ce côté, plutôt qu'un
      // repli arbitraire sur le mois en cours qui masquerait la saisie.
      const from = parseDayParam(p.from);
      const to = parseDayParam(p.to);
      const range: DueRange = {};
      if (from) range.gte = from;
      if (to) range.lt = nextUtcDay(to); // borne haute INCLUSIVE
      // Bornes inversées : on les remet dans l'ordre plutôt que de ne rien montrer.
      if (range.gte && range.lt && range.gte >= range.lt) {
        return { gte: to!, lt: nextUtcDay(from!) };
      }
      return range;
    }

    default:
      // « À venir » : à partir d'aujourd'hui (inclus).
      return { gte: start };
  }
}
