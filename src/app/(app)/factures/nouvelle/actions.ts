"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { parseInvoiceForm, type InvoiceFormState } from "@/lib/invoices/form";
import { resolveParty } from "@/lib/invoices/party";
import { requireUser } from "@/lib/auth";

/** Crée une facture saisie manuellement (sans PDF). */
export async function createInvoice(
  _prev: InvoiceFormState,
  formData: FormData,
): Promise<InvoiceFormState> {
  const me = await requireUser();
  const parsed = parseInvoiceForm(formData);
  if (!parsed.ok) return { error: parsed.error };
  const { data, lines, coherence } = parsed;

  const party = await resolveParty(prisma, {
    name: data.partyName,
    address: data.partyAddress,
    siret: data.siret,
    vatNumber: data.vatNumber,
    direction: data.direction,
  });

  // Avertissement doublon (même numéro + même tiers)
  let notes = data.notes;
  if (data.number && party.partyName) {
    const dup = await prisma.invoice.findFirst({
      where: { number: data.number, partyName: party.partyName },
      select: { id: true },
    });
    if (dup) {
      notes = [
        "⚠️ Une facture portant le même numéro et le même tiers existe déjà. Vérifiez qu'il ne s'agit pas d'un doublon.",
        notes,
      ]
        .filter(Boolean)
        .join(" ");
    }
  }

  let id: string;
  try {
    const created = await prisma.invoice.create({
      data: {
        ...data,
        notes,
        partyId: party.partyId,
        partyName: party.partyName,
        partyAddress: party.partyAddress,
        siret: party.siret,
        vatNumber: party.vatNumber,
        status: "a_verifier",
        coherence,
        vatLines: { create: lines },
        revisions: {
          create: { field: "Création", oldValue: "—", newValue: "Saisie manuelle", userName: me.name },
        },
      },
    });
    id = created.id;
  } catch (e) {
    console.error("Création de la facture échouée :", e);
    return { error: "La création a échoué. Vérifiez les valeurs saisies et réessayez." };
  }

  redirect(`/factures/${id}`);
}
