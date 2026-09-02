import { PageHeader, Card, Badge } from "@/components/ui";
import { VAT_RATES, TVA_DISCLAIMER } from "@/lib/tva/rules";
import { CATEGORIES, STATUSES } from "@/lib/domain/enums";

export default function ParametresPage() {
  const parser = process.env.INVOICE_PARSER ?? "heuristic";
  const parserLabel: Record<string, string> = {
    heuristic: "Lecture du texte du PDF + règles (par défaut)",
    stub: "Aucune analyse (saisie 100 % manuelle)",
  };

  return (
    <>
      <PageHeader title="Paramètres" subtitle="Configuration de l'application." />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className="mb-2 text-sm font-semibold">Analyse des factures</h2>
          <p className="text-sm text-[var(--muted)]">
            Moteur actuel : <Badge tone="info">{parser}</Badge>
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">{parserLabel[parser] ?? parser}</p>
          <p className="mt-2 text-xs text-[var(--muted)]">
            Se règle via la variable <code>INVOICE_PARSER</code> du fichier <code>.env</code>.
            La clé API éventuelle (<code>INVOICE_PARSER_API_KEY</code>) ne doit jamais être mise
            dans le code source.
          </p>
        </Card>

        <Card className="p-4">
          <h2 className="mb-2 text-sm font-semibold">Taux de TVA gérés</h2>
          <ul className="text-sm">
            {VAT_RATES.map((r) => (
              <li key={r.rate} className="flex justify-between border-b border-[var(--border)] py-1">
                <span>{r.label}</span>
                <span className="text-[var(--muted)]">{r.note}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-[var(--muted)]">
            Modifiable dans <code>src/lib/tva/rules.ts</code> (zone des règles fiscales).
          </p>
        </Card>

        <Card className="p-4">
          <h2 className="mb-2 text-sm font-semibold">Catégories</h2>
          <div className="flex flex-wrap gap-1.5">
            {Object.values(CATEGORIES).map((c) => (
              <Badge key={c}>{c}</Badge>
            ))}
          </div>
          <p className="mt-2 text-xs text-[var(--muted)]">
            Extensible dans <code>src/lib/domain/enums.ts</code>.
          </p>
        </Card>

        <Card className="p-4">
          <h2 className="mb-2 text-sm font-semibold">Statuts des factures</h2>
          <div className="flex flex-wrap gap-1.5">
            {Object.values(STATUSES).map((s) => (
              <Badge key={s}>{s}</Badge>
            ))}
          </div>
        </Card>
      </div>

      <Card className="mt-4 p-4">
        <h2 className="mb-2 text-sm font-semibold">Avertissement</h2>
        <p className="text-sm text-[var(--muted)]">{TVA_DISCLAIMER}</p>
        <p className="mt-2 text-xs text-[var(--muted)]">
          Les fonctionnalités de sécurité (authentification, comptes, permissions, chiffrement,
          sauvegardes, journalisation complète) sont prévues dans l&apos;architecture mais pas
          encore activées dans cette première version.
        </p>
      </Card>
    </>
  );
}
