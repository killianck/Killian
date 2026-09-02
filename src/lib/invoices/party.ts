// Rattachement d'une facture à une fiche Tiers (fournisseur / client).
// Évite de retaper les coordonnées : si le nom correspond à un tiers connu,
// la facture est reliée et les champs manquants sont complétés.

import type { PrismaClient } from "@prisma/client";

export const PARTY_KINDS = {
  fournisseur: "Fournisseur",
  client: "Client",
  les_deux: "Fournisseur et client",
} as const;
export type PartyKind = keyof typeof PARTY_KINDS;

/** Normalisation pour comparer des noms de tiers. */
export function normalizePartyName(s: string | null | undefined): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\b(s\.?a\.?s\.?u?|s\.?a\.?r\.?l|e\.?u\.?r\.?l|s\.?c\.?i|s\.?a|e\.?i)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function kindFromDirection(direction: string): PartyKind {
  return direction === "vente" ? "client" : "fournisseur";
}

/** Fusionne deux "kind" (un tiers peut être fournisseur ET client). */
function mergeKind(current: string, incoming: PartyKind): PartyKind {
  if (current === "les_deux" || (current !== incoming && current !== "")) return "les_deux";
  return incoming;
}

type Tiers = {
  name: string | null;
  address?: string | null;
  siret?: string | null;
  vatNumber?: string | null;
  direction: string;
};

export type PartyResolution = {
  partyId: string | null;
  // champs à enregistrer sur la facture (complétés depuis la fiche si vides)
  partyName: string | null;
  partyAddress: string | null;
  siret: string | null;
  vatNumber: string | null;
};

/**
 * Trouve (ou crée) la fiche Tiers correspondant au nom donné, et renvoie
 * l'id + les coordonnées à enregistrer sur la facture.
 */
export async function resolveParty(prisma: PrismaClient, t: Tiers): Promise<PartyResolution> {
  const name = t.name?.trim() || null;
  const base: PartyResolution = {
    partyId: null,
    partyName: name,
    partyAddress: t.address ?? null,
    siret: t.siret ?? null,
    vatNumber: t.vatNumber ?? null,
  };
  if (!name) return base;

  const wantedKind = kindFromDirection(t.direction);
  const norm = normalizePartyName(name);

  // Recherche : par SIRET exact, sinon par nom normalisé
  const candidates = await prisma.party.findMany({
    where: t.siret
      ? { OR: [{ siret: t.siret }, { name: { contains: name.slice(0, 40) } }] }
      : { name: { contains: name.slice(0, 40) } },
    take: 50,
  });
  let match =
    (t.siret && candidates.find((c) => c.siret === t.siret)) ||
    candidates.find((c) => normalizePartyName(c.name) === norm) ||
    null;

  if (match) {
    const data: Record<string, unknown> = {};
    const nextKind = mergeKind(match.kind, wantedKind);
    if (nextKind !== match.kind) data.kind = nextKind;
    if (!match.address && t.address) data.address = t.address;
    if (!match.siret && t.siret) data.siret = t.siret;
    if (!match.vatNumber && t.vatNumber) data.vatNumber = t.vatNumber;
    if (Object.keys(data).length) {
      match = await prisma.party.update({ where: { id: match.id }, data });
    }
  } else {
    match = await prisma.party.create({
      data: {
        name,
        kind: wantedKind,
        address: t.address ?? null,
        siret: t.siret ?? null,
        vatNumber: t.vatNumber ?? null,
      },
    });
  }

  return {
    partyId: match.id,
    partyName: match.name,
    partyAddress: t.address ?? match.address ?? null,
    siret: t.siret ?? match.siret ?? null,
    vatNumber: t.vatNumber ?? match.vatNumber ?? null,
  };
}
