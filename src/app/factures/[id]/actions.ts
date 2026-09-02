"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { STATUSES, type Status } from "@/lib/domain/enums";

/**
 * Change le statut d'une facture (validation manuelle, retour "à vérifier", etc.).
 * Trace le changement dans le journal des modifications.
 */
export async function setInvoiceStatus(id: string, status: Status): Promise<void> {
  if (!(status in STATUSES)) return;

  const current = await prisma.invoice.findUnique({ where: { id }, select: { status: true } });
  if (!current || current.status === status) return;

  await prisma.$transaction([
    prisma.invoice.update({ where: { id }, data: { status } }),
    prisma.invoiceRevision.create({
      data: {
        invoiceId: id,
        field: "Statut",
        oldValue: STATUSES[current.status as Status] ?? current.status,
        newValue: STATUSES[status],
      },
    }),
  ]);

  revalidatePath(`/factures/${id}`);
  revalidatePath("/factures");
}
