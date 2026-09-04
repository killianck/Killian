// Relevés de factures : rapprochement et « compensation ».
//
// Un RELEVÉ liste plusieurs factures déjà émises et en donne le cumul. Si une de
// ces factures a AUSSI été déposée seule dans le logiciel, il ne faut pas la
// compter deux fois dans la TVA.
//
// Principe retenu (validé avec l'utilisateur) : le relevé ne compte, dans les
// totaux de TVA, QUE la part des factures encore ABSENTES du logiciel. Dès qu'une
// facture du détail est déposée, elle est rapprochée (par numéro) et le relevé
// « rétrécit » automatiquement d'autant. Quand toutes les factures sont là, le
// relevé ne pèse plus rien.
//
// Ce module contient :
//   1. des fonctions PURES (rapprochement + calcul), testées isolément ;
//   2. `reconcileStatements(db)` qui les applique en base (appelé après chaque
//      dépôt / modification / suppression de facture).

import type { PrismaClient } from "@prisma/client";
import { round2, EXTRACTION_VAT_RATES } from "@/lib/tva/rules";

// ---------------------------------------------------------------------------
//  Normalisation
// ---------------------------------------------------------------------------

/** Numéro de facture réduit à ses lettres/chiffres, en majuscules. */
export function normRef(s: string | null | undefined): string {
  return (s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Nom de tiers réduit à ses lettres/chiffres (sans accents ni forme juridique). */
export function normParty(s: string | null | undefined): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\b(s\.?a\.?s\.?u?|s\.?a\.?r\.?l|e\.?u\.?r\.?l|s\.?c\.?i|s\.?a|e\.?i)\b/g, "")
    .replace(/[^a-z0-9]/g, "");
}

// ---------------------------------------------------------------------------
//  Rapprochement (pur)
// ---------------------------------------------------------------------------

export type StatementLineInput = {
  reference: string;
  amountHT?: number | null;
  amountVAT?: number | null;
  amountTTC?: number | null;
};

export type CandidateInvoice = {
  id: string;
  number: string | null;
  partyName: string | null;
  partyId: string | null;
  direction: string;
  documentType: string;
  isStatement: boolean;
  totalHT: number;
  totalVAT: number;
  totalTTC: number;
};

export type LineMatch = {
  reference: string;
  matchedInvoiceId: string | null;
  /** Montant TTC retenu pour la ligne (celui de la facture rapprochée si elle est
   *  déjà chiffrée, sinon celui imprimé sur le relevé). */
  ttc: number;
  ht: number | null;
  vat: number | null;
  /** true si le TTC imprimé sur le relevé diffère nettement de celui de la facture rapprochée. */
  amountMismatch?: { line: number; invoice: number };
  /** true si la facture rapprochée est un avoir (cas à signaler). */
  matchedIsAvoir?: boolean;
  /** true si le rapprochement ne s'appuie QUE sur le numéro (fournisseur inconnu
   *  d'un côté) — moins fiable, ne doit jamais passer inaperçu. */
  uncertainParty?: boolean;
};

/**
 * Rapproche chaque ligne du relevé d'une facture déjà saisie : même numéro
 * (normalisé), même SENS (achat/vente — un relevé fournisseur ne peut rapprocher
 * que des factures d'achat) ET même fournisseur (id identique, nom compatible, ou
 * l'un des deux inconnu). Une facture ne peut être rapprochée qu'à une seule ligne.
 */
export function matchStatementLines(
  statement: { partyName: string | null; partyId: string | null; direction: string },
  lines: StatementLineInput[],
  invoices: CandidateInvoice[],
): LineMatch[] {
  const usable = invoices.filter(
    (inv) => !inv.isStatement && inv.direction === statement.direction && normRef(inv.number).length > 0,
  );
  const sName = normParty(statement.partyName);
  const claimed = new Set<string>();

  return lines.map((line) => {
    const ref = normRef(line.reference);
    const ht = line.amountHT ?? null;
    const vat = line.amountVAT ?? null;
    const ttcFromLine = line.amountTTC ?? null;

    const base: LineMatch = {
      reference: line.reference,
      matchedInvoiceId: null,
      ttc: ttcFromLine ?? 0,
      ht,
      vat,
    };
    if (!ref) return base;

    const scored = usable
      .filter((inv) => normRef(inv.number) === ref && !claimed.has(inv.id))
      .map((inv) => {
        const iName = normParty(inv.partyName);
        let score: number;
        if (statement.partyId && inv.partyId && statement.partyId === inv.partyId) score = 3;
        else if (sName && iName && (sName === iName || sName.includes(iName) || iName.includes(sName))) score = 2;
        else if (!sName || !iName) score = 1; // l'un des deux fournisseurs inconnu : on tolère
        else score = -1; // deux noms différents et non vides : pas le même fournisseur
        return { inv, score };
      })
      .filter((c) => c.score >= 1)
      .sort((a, b) => b.score - a.score);

    const winner = scored[0];
    const best = winner?.inv;
    if (!best) return base;
    claimed.add(best.id);

    // La facture déjà ANALYSÉE (montant chiffré) fait autorité sur le montant
    // imprimé sur le relevé : un relevé « solde cumulé » (relevé de compte) donne
    // parfois, par ligne, un solde et non le montant de la facture elle-même.
    const analyzed = best.totalTTC > 0;
    const out: LineMatch = {
      reference: line.reference,
      matchedInvoiceId: best.id,
      ttc: analyzed ? best.totalTTC : ttcFromLine ?? 0,
      ht: analyzed ? best.totalHT || null : ht,
      vat: analyzed ? best.totalVAT || null : vat,
      matchedIsAvoir: best.documentType === "avoir" || undefined,
      uncertainParty: winner.score === 1 || undefined,
    };
    // Écart de montant — seulement si la facture a bien été chiffrée (TTC > 0).
    if (ttcFromLine != null && analyzed && Math.abs(ttcFromLine - best.totalTTC) > 0.02) {
      out.amountMismatch = { line: ttcFromLine, invoice: best.totalTTC };
    }
    return out;
  });
}

// ---------------------------------------------------------------------------
//  Calcul des totaux « compensés » (pur)
// ---------------------------------------------------------------------------

export type StatementComputation = {
  /** Totaux à STOCKER sur le relevé = part NON encore couverte par des factures saisies. */
  totalHT: number;
  totalVAT: number;
  totalTTC: number;
  vatLines: { rate: number; baseHT: number; vatAmount: number }[];
  matchedCount: number;
  lineCount: number;
  coveredTTC: number;
  remainingTTC: number;
  coherence: "coherent" | "a_verifier" | "incoherent";
  /** Messages destinés à l'utilisateur. */
  notes: string[];
  /** Références du relevé pas encore retrouvées dans le logiciel (ni ailleurs). */
  missingRefs: string[];
  /** Cumul du relevé RETENU pour le calcul (imprimé, sinon déduit des lignes) —
   *  à ré-enregistrer comme statementGross* quand celui-ci était absent, pour que
   *  l'affichage (« Cumul du relevé ») ne devienne pas obsolète. */
  grossHT: number;
  grossVAT: number;
  grossTTC: number;
};

function impliedStandardRate(vat: number, ht: number): number | undefined {
  if (ht <= 0 || vat < 0) return undefined;
  const r = (vat / ht) * 100;
  return EXTRACTION_VAT_RATES.find((s) => Math.abs(s - r) <= 0.2);
}

/**
 * À partir des totaux imprimés sur le relevé et du rapprochement des lignes,
 * calcule ce que le relevé doit réellement peser (les factures manquantes).
 *
 * `crossCoveredRefs` : références (normalisées) à traiter comme déjà comptées —
 * PAS dans ce relevé, mais dans un AUTRE relevé du même fournisseur (cas d'une
 * facture encore impayée re-listée sur plusieurs relevés successifs). Elles ne
 * sont ni « manquantes » ni « rapprochées » ici : simplement retirées du reste à
 * couvrir pour ne pas les compter une deuxième fois.
 */
export function computeStatement(
  gross: { ht?: number | null; vat?: number | null; ttc?: number | null },
  lines: StatementLineInput[],
  matches: LineMatch[],
  crossCoveredRefs?: Set<string>,
): StatementComputation {
  const notes: string[] = [];
  const lineCount = lines.length;
  const crossCovered = crossCoveredRefs ?? new Set<string>();

  // Totaux du relevé : ceux imprimés, sinon la somme des lignes.
  const sum = (pick: (l: StatementLineInput) => number | null | undefined) =>
    round2(lines.reduce((s, l) => s + (pick(l) ?? 0), 0));
  const grossTTC = gross.ttc ?? sum((l) => l.amountTTC);
  const grossHT = gross.ht ?? sum((l) => l.amountHT);
  const grossVAT = gross.vat ?? (grossHT && grossTTC ? round2(grossTTC - grossHT) : sum((l) => l.amountVAT));
  // HT/TVA vraiment DÉTERMINÉS (imprimés, ou déductibles des lignes) — sinon le 0
  // par défaut serait présenté comme une valeur sûre alors que c'est une absence
  // de donnée.
  const htVatKnown =
    gross.ht != null || gross.vat != null || lines.some((l) => l.amountHT != null || l.amountVAT != null);

  const matched = matches.filter((m) => m.matchedInvoiceId);
  const suppressed = matches.filter((m) => !m.matchedInvoiceId && crossCovered.has(normRef(m.reference)));
  const stillMissing = matches.filter((m) => !m.matchedInvoiceId && !crossCovered.has(normRef(m.reference)));
  const matchedCount = matched.length;
  const missingRefs = stillMissing.map((m) => m.reference);

  // Part déjà couverte : par une facture rapprochée, OU par un autre relevé.
  const coveredEntries = [...matched, ...suppressed];
  const coveredTTC = round2(coveredEntries.reduce((s, m) => s + m.ttc, 0));
  let coveredHT = round2(coveredEntries.reduce((s, m) => s + (m.ht ?? 0), 0));
  let coveredVAT = round2(coveredEntries.reduce((s, m) => s + (m.vat ?? 0), 0));

  // Si le HT/TVA d'une ligne couverte manque, on le répartit au prorata du TTC.
  const coveredWithoutHT = coveredEntries.some((m) => m.ht == null);
  if (coveredWithoutHT && grossTTC > 0 && grossHT) {
    coveredHT = round2((coveredTTC * grossHT) / grossTTC);
    coveredVAT = round2((coveredTTC * (grossVAT || grossTTC - grossHT)) / grossTTC);
    notes.push("Répartition HT/TVA du relevé estimée au prorata des montants TTC — à vérifier.");
  }

  const clamp = (n: number) => (Math.abs(n) < 0.01 ? 0 : round2(n));
  const remainingTTC = clamp(grossTTC - coveredTTC);
  const remainingHT = clamp(grossHT - coveredHT);
  const remainingVAT = clamp(grossVAT - coveredVAT);

  // Lignes de TVA du relevé « compensé ».
  let vatLines: StatementComputation["vatLines"] = [];
  if (remainingHT > 0 && remainingVAT >= 0) {
    const rate = impliedStandardRate(remainingVAT, remainingHT);
    if (rate !== undefined) {
      vatLines = [{ rate, baseHT: remainingHT, vatAmount: remainingVAT }];
    } else {
      notes.push(
        `Le taux de TVA du reste à couvrir (${round2((remainingVAT / remainingHT) * 100)} %) ne correspond à aucun taux connu — le relevé mélange peut-être plusieurs taux, à vérifier.`,
      );
    }
  }
  if (!htVatKnown && grossTTC > 0) {
    notes.push(
      "Le total HT/TVA imprimé sur le relevé n'a pas pu être lu : 0 € a été retenu par défaut pour ces montants — à corriger manuellement, ne pas considérer comme vérifié.",
    );
  }

  // Cohérence / messages.
  const mismatches = matches.filter((m) => m.amountMismatch);
  for (const m of mismatches) {
    notes.push(
      `La facture ${m.reference} est enregistrée à ${m.amountMismatch!.invoice.toFixed(2)} € TTC mais le relevé indique ${m.amountMismatch!.line.toFixed(2)} € — à vérifier.`,
    );
  }
  if (matches.some((m) => m.matchedIsAvoir)) {
    notes.push("Une des factures rapprochées est un AVOIR — vérifiez le montant compensé.");
  }
  const uncertain = matches.filter((m) => m.uncertainParty && m.matchedInvoiceId);
  if (uncertain.length) {
    notes.push(
      `Rapprochement fondé sur le seul numéro (fournisseur non renseigné d'un côté) pour : ${uncertain.map((m) => m.reference).join(", ")} — vérifiez qu'il s'agit bien de la même facture.`,
    );
  }
  if (suppressed.length) {
    notes.push(
      `${suppressed.length} référence(s) déjà comptée(s) via un autre relevé plus récent du même fournisseur : ${suppressed.map((m) => m.reference).join(", ")}.`,
    );
  }

  if (lineCount === 0) {
    notes.unshift(
      "Relevé sans détail lisible : le rapprochement automatique est impossible. Déposez les factures listées une par une (et, si besoin, reclassez ce document en facture simple).",
    );
  } else if (missingRefs.length === 0) {
    notes.unshift(`Relevé entièrement rapproché : ${matchedCount}/${lineCount} factures sont dans le logiciel. Ce relevé ne compte plus dans la TVA.`);
  } else {
    notes.unshift(
      `Relevé rapproché à ${matchedCount}/${lineCount}. Manquantes (comptées via le relevé) : ${missingRefs.join(", ")}. Déposez ces factures pour un suivi complet.`,
    );
  }

  let coherence: StatementComputation["coherence"] = "a_verifier";
  if (missingRefs.length === 0 && remainingTTC === 0 && mismatches.length === 0 && uncertain.length === 0) {
    coherence = "coherent";
  } else if (coveredTTC - grossTTC > 0.05) {
    coherence = "incoherent";
    notes.push("Les factures rapprochées dépassent le total du relevé — à vérifier.");
  }

  return {
    totalHT: Math.max(0, remainingHT),
    totalVAT: Math.max(0, remainingVAT),
    totalTTC: Math.max(0, remainingTTC),
    vatLines,
    matchedCount,
    lineCount,
    coveredTTC,
    remainingTTC: Math.max(0, remainingTTC),
    coherence,
    notes,
    missingRefs,
    grossHT,
    grossVAT,
    grossTTC,
  };
}

// ---------------------------------------------------------------------------
//  Application en base
// ---------------------------------------------------------------------------

type DB = Pick<PrismaClient, "invoice" | "statementLine" | "vatLine" | "$transaction">;

/**
 * Recalcule TOUS les relevés : rapprochement des lignes + totaux compensés +
 * lignes de TVA + cohérence. Idempotent. À appeler après chaque dépôt /
 * modification / suppression de facture (l'opération est très rapide : il y a peu
 * de relevés et peu de factures).
 */
export async function reconcileStatements(db: DB): Promise<void> {
  const statements = await db.invoice.findMany({
    where: { isStatement: true },
    include: { statementLines: true },
  });
  if (statements.length === 0) return;

  // Toutes les factures individuelles (achat ET vente : le filtre par sens se
  // fait par relevé, dans matchStatementLines, pas ici).
  const invoices = await db.invoice.findMany({
    where: { isStatement: false },
    select: {
      id: true, number: true, partyName: true, partyId: true, direction: true,
      documentType: true, isStatement: true, totalHT: true, totalVAT: true, totalTTC: true,
    },
  });

  // Passe 1 : rapprochement indépendant de chaque relevé.
  const perStatement = statements.map((st) => {
    const lines: StatementLineInput[] = st.statementLines.map((l) => ({
      reference: l.reference,
      amountHT: l.amountHT,
      amountVAT: l.amountVAT,
      amountTTC: l.amountTTC,
    }));
    const matches = matchStatementLines(
      { partyName: st.partyName, partyId: st.partyId, direction: st.direction },
      lines,
      invoices,
    );
    return { st, lines, matches };
  });

  // Passe 2 : une même référence NON rapprochée, listée sur PLUSIEURS relevés du
  // même fournisseur (ex. « situation de compte » qui re-liste chaque mois une
  // facture encore impayée), ne doit être comptée dans le reste à couvrir que
  // par UN SEUL relevé — le plus récent — sous peine de double comptage.
  const owners = new Map<string, string>(); // clé -> id du relevé « propriétaire »
  for (const { st, matches } of perStatement) {
    for (const m of matches) {
      if (m.matchedInvoiceId) continue;
      const key = `${normRef(m.reference)}|${normParty(st.partyName)}`;
      const currentOwnerId = owners.get(key);
      if (!currentOwnerId) {
        owners.set(key, st.id);
        continue;
      }
      const currentOwner = statements.find((s) => s.id === currentOwnerId)!;
      const moreRecent =
        st.invoiceDate.getTime() > currentOwner.invoiceDate.getTime() ||
        (st.invoiceDate.getTime() === currentOwner.invoiceDate.getTime() && st.id > currentOwner.id);
      if (moreRecent) owners.set(key, st.id);
    }
  }

  for (const { st, lines, matches } of perStatement) {
    const crossCoveredRefs = new Set<string>();
    for (const m of matches) {
      if (m.matchedInvoiceId) continue;
      const key = `${normRef(m.reference)}|${normParty(st.partyName)}`;
      if (owners.get(key) !== st.id) crossCoveredRefs.add(normRef(m.reference));
    }

    const comp = computeStatement(
      { ht: st.statementGrossHT, vat: st.statementGrossVAT, ttc: st.statementGrossTTC },
      lines,
      matches,
      crossCoveredRefs,
    );

    const noteText = comp.notes.join("\n");
    // Si le cumul imprimé n'a pas pu être lu, on retient (et on mémorise) celui
    // déduit des lignes — sinon l'affichage (« Cumul du relevé ») deviendrait
    // obsolète dès qu'une ligne est rapprochée (voir computeStatement.grossTTC).
    const grossBackfill: Record<string, number> = {};
    if (st.statementGrossHT == null && comp.grossHT) grossBackfill.statementGrossHT = comp.grossHT;
    if (st.statementGrossVAT == null && comp.grossVAT) grossBackfill.statementGrossVAT = comp.grossVAT;
    if (st.statementGrossTTC == null && comp.grossTTC) grossBackfill.statementGrossTTC = comp.grossTTC;

    // Rien n'a changé depuis le dernier calcul : on évite une écriture inutile.
    const sameLinks = st.statementLines.every((l, i) => (l.matchedInvoiceId ?? null) === (matches[i]?.matchedInvoiceId ?? null));
    const sameTotals =
      Math.abs(st.totalHT - comp.totalHT) < 0.005 &&
      Math.abs(st.totalVAT - comp.totalVAT) < 0.005 &&
      Math.abs(st.totalTTC - comp.totalTTC) < 0.005;
    if (
      sameLinks && sameTotals && st.coherence === comp.coherence &&
      (st.notes ?? "") === (noteText || "") && Object.keys(grossBackfill).length === 0
    ) {
      continue;
    }

    await db.$transaction([
      ...st.statementLines.map((l, i) =>
        db.statementLine.update({
          where: { id: l.id },
          data: { matchedInvoiceId: matches[i]?.matchedInvoiceId ?? null },
        }),
      ),
      db.vatLine.deleteMany({ where: { invoiceId: st.id } }),
      db.invoice.update({
        where: { id: st.id },
        data: {
          ...grossBackfill,
          totalHT: comp.totalHT,
          totalVAT: comp.totalVAT,
          totalTTC: comp.totalTTC,
          coherence: comp.coherence,
          notes: noteText || null,
          vatLines: comp.vatLines.length ? { create: comp.vatLines } : undefined,
        },
      }),
    ]);
  }
}

let lastThrottled = 0;

/**
 * Version « au démarrage / navigation » : au plus une fois toutes les 30 s.
 * Rattrape les cas hors flux normal (restauration de sauvegarde, course entre
 * l'analyse d'un relevé et l'ajout d'une facture…).
 */
export async function reconcileStatementsThrottled(db: DB, now = Date.now()): Promise<void> {
  if (now - lastThrottled < 30_000) return;
  lastThrottled = now;
  try {
    await reconcileStatements(db);
  } catch (e) {
    console.error("Rapprochement périodique des relevés impossible :", e);
  }
}
