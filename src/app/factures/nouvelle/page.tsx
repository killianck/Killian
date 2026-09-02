import Link from "next/link";
import { PageHeader, Card } from "@/components/ui";
import { InvoiceForm, type EditableInvoice } from "@/components/InvoiceForm";
import { toDateInputValue } from "@/lib/format";
import { createInvoice } from "./actions";

const blank: EditableInvoice = {
  documentType: "facture",
  direction: "achat",
  category: null,
  number: null,
  invoiceDate: toDateInputValue(new Date()),
  dueDate: "",
  partyName: null,
  partyAddress: null,
  siret: null,
  vatNumber: null,
  currency: "EUR",
  notes: null,
  totalHT: 0,
  totalVAT: 0,
  totalTTC: 0,
  vatLines: [],
};

export default function NouvelleFacturePage() {
  return (
    <>
      <PageHeader
        title="Saisir une facture"
        subtitle="Pour une facture sans PDF (facture papier, PDF non disponible…). Le contrôle de cohérence s'applique aussi."
        action={
          <Link href="/factures" className="text-sm text-[var(--muted)]">
            ← Retour
          </Link>
        }
      />
      <Card className="p-6">
        <InvoiceForm
          invoice={blank}
          action={createInvoice}
          submitLabel="Créer la facture"
          cancelHref="/factures"
        />
      </Card>
    </>
  );
}
