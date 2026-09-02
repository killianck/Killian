"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { parseInvoiceForm, type InvoiceFormState } from "@/lib/invoices/form";

/** Crée une facture saisie manuellement (sans PDF). */
export async function createInvoice(
  _prev: InvoiceFormState,
  formData: FormData,
): Promise<InvoiceFormState> {
  const parsed = parseInvoiceForm(formData);
  if (!parsed.ok) return { error: parsed.error };
  const { data, lines, coherence } = parsed;

  // Avertissement doublon (même numéro + même tiers)
  let notes = data.notes;
  if (data.number && data.partyName) {
    const dup = await prisma.invoice.findFirst({
      where: { number: data.number, partyName: data.partyName },
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
        status: "a_verifier",
        coherence,
        vatLines: { create: lines },
        revisions: {
          create: { field: "Création", oldValue: "—", newValue: "Saisie manuelle" },
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
