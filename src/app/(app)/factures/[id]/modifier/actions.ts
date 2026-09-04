"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { parseInvoiceForm, type InvoiceFormState } from "@/lib/invoices/form";
import { resolveParty } from "@/lib/invoices/party";
import { reconcileStatements } from "@/lib/invoices/statements";
import { diffInvoice } from "@/lib/domain/revisions";
import { requireUser } from "@/lib/auth";

export async function updateInvoice(
  id: string,
  _prev: InvoiceFormState,
  formData: FormData,
): Promise<InvoiceFormState> {
  const me = await requireUser();
  const existing = await prisma.invoice.findUnique({
    where: { id },
    include: { vatLines: true },
  });
  if (!existing) return { error: "Facture introuvable." };

  const parsed = parseInvoiceForm(formData);
  if (!parsed.ok) return { error: parsed.error };
  const { lines, coherence } = parsed;

  const party = await resolveParty(prisma, {
    name: parsed.data.partyName,
    address: parsed.data.partyAddress,
    siret: parsed.data.siret,
    vatNumber: parsed.data.vatNumber,
    direction: parsed.data.direction,
  });
  const data = {
    ...parsed.data,
    partyId: party.partyId,
    partyName: party.partyName,
    partyAddress: party.partyAddress,
    siret: party.siret,
    vatNumber: party.vatNumber,
  };

  // --- Journal des modifications ---
  const before = {
    ...existing,
    vatLines: existing.vatLines.map((l) => ({ rate: l.rate, baseHT: l.baseHT, vatAmount: l.vatAmount })),
  };
  const after = { ...data, vatLines: lines };
  const revisions = diffInvoice(before as Record<string, unknown>, after as Record<string, unknown>);

  // Une facture "à analyser" corrigée passe "à vérifier".
  // Une facture "validée" que l'on modifie repasse "à vérifier".
  const nextStatus =
    existing.status === "a_analyser" || existing.status === "analyse_en_cours" || existing.status === "validee"
      ? "a_verifier"
      : existing.status;

  // Pour un relevé, les montants saisis à la main sont le CUMUL imprimé : on les
  // enregistre comme tels, puis le rapprochement recalcule la part « compensée ».
  const statementGross = existing.isStatement
    ? {
        statementGrossHT: data.totalHT,
        statementGrossVAT: data.totalVAT,
        statementGrossTTC: data.totalTTC,
      }
    : {};

  try {
    await prisma.$transaction([
      prisma.vatLine.deleteMany({ where: { invoiceId: id } }),
      prisma.invoice.update({
        where: { id },
        data: {
          ...data,
          ...statementGross,
          status: nextStatus,
          coherence,
          confidence: null, // corrigée à la main : l'indice de confiance auto ne s'applique plus
          vatLines: { create: lines },
        },
      }),
      ...revisions.map((r) =>
        prisma.invoiceRevision.create({
          data: { invoiceId: id, field: r.field, oldValue: r.oldValue, newValue: r.newValue, userName: me.name },
        }),
      ),
    ]);
    await reconcileStatements(prisma);
  } catch (e) {
    console.error("Échec de l'enregistrement de la facture :", e);
    return { error: "L'enregistrement a échoué. Vérifiez les valeurs saisies et réessayez." };
  }

  redirect(`/factures/${id}`);
}
