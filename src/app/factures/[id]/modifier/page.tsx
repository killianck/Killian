import Link from "next/link";
import { notFound } from "next/navigation";
import { getInvoice } from "@/lib/queries";
import { PageHeader, Card } from "@/components/ui";
import { toDateInputValue } from "@/lib/format";
import { InvoiceForm, type EditableInvoice } from "@/components/InvoiceForm";
import { updateInvoice } from "./actions";

export const dynamic = "force-dynamic";

export default async function ModifierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const inv = await getInvoice(id);
  if (!inv) notFound();

  const editable: EditableInvoice = {
    documentType: inv.documentType,
    direction: inv.direction,
    category: inv.category,
    number: inv.number,
    invoiceDate: toDateInputValue(inv.invoiceDate),
    dueDate: toDateInputValue(inv.dueDate),
    partyName: inv.partyName,
    partyAddress: inv.partyAddress,
    siret: inv.siret,
    vatNumber: inv.vatNumber,
    currency: inv.currency,
    notes: inv.notes,
    totalHT: inv.totalHT,
    totalVAT: inv.totalVAT,
    totalTTC: inv.totalTTC,
    vatLines: inv.vatLines.map((l) => ({ rate: l.rate, baseHT: l.baseHT, vatAmount: l.vatAmount })),
  };

  return (
    <>
      <PageHeader
        title={`Modifier la facture ${inv.number ?? ""}`.trim()}
        subtitle="Corrigez les informations extraites. Toute modification est enregistrée dans le journal."
        action={
          <Link href={`/factures/${inv.id}`} className="text-sm text-[var(--muted)]">
            ← Retour à la fiche
          </Link>
        }
      />
      <Card className="p-6">
        <InvoiceForm
          invoice={editable}
          action={updateInvoice.bind(null, inv.id)}
          submitLabel="Enregistrer les modifications"
          cancelHref={`/factures/${inv.id}`}
        />
      </Card>
    </>
  );
}
