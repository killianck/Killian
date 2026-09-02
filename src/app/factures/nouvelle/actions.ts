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

  let id: string;
  try {
    const created = await prisma.invoice.create({
      data: {
        ...data,
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
