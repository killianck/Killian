"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { PARTY_KINDS } from "@/lib/invoices/party";

export type PartyFormState = { error?: string };

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const orNull = (v: string) => (v === "" ? null : v);

export async function updateParty(
  id: string,
  _prev: PartyFormState,
  fd: FormData,
): Promise<PartyFormState> {
  const name = str(fd, "name");
  if (!name) return { error: "Le nom est obligatoire." };

  const kind = str(fd, "kind");
  const data = {
    name,
    kind: kind in PARTY_KINDS ? kind : "les_deux",
    address: orNull(str(fd, "address")),
    siret: orNull(str(fd, "siret")),
    vatNumber: orNull(str(fd, "vatNumber")),
    email: orNull(str(fd, "email")),
    phone: orNull(str(fd, "phone")),
    notes: orNull(str(fd, "notes")),
  };

  try {
    await prisma.$transaction([
      prisma.party.update({ where: { id }, data }),
      // garde le nom "à plat" des factures synchronisé
      prisma.invoice.updateMany({ where: { partyId: id }, data: { partyName: name } }),
    ]);
  } catch (e) {
    console.error("Enregistrement du tiers impossible :", e);
    return { error: "L'enregistrement a échoué. Réessayez." };
  }

  revalidatePath(`/tiers/${id}`);
  revalidatePath("/tiers");
  redirect(`/tiers/${id}`);
}

export async function deleteParty(id: string): Promise<void> {
  // Les factures liées gardent leur nom ; elles sont simplement "déliées".
  await prisma.invoice.updateMany({ where: { partyId: id }, data: { partyId: null } });
  await prisma.party.delete({ where: { id } });
  revalidatePath("/tiers");
  redirect("/tiers");
}
