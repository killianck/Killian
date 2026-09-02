import Link from "next/link";
import { PageHeader, Card } from "@/components/ui";
import { ImportForm } from "./ImportForm";

export default function ImporterPage() {
  return (
    <>
      <PageHeader
        title="Importer une facture"
        subtitle="Déposez un PDF. Le fichier original est conservé et associé à la facture."
        action={<Link href="/factures" className="text-sm text-[var(--muted)]">← Retour</Link>}
      />
      <Card className="p-6">
        <ImportForm />
      </Card>
    </>
  );
}
