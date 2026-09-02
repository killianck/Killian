import Link from "next/link";
import { addMonths, formatMonthLabel } from "@/lib/format";

/**
 * Navigation entre les mois (‹ précédent / mois affiché / suivant ›)
 * + retour au mois en cours. Fonctionne par simples liens (aucun JavaScript requis).
 */
export function PeriodNav({
  year,
  month,
  basePath = "/",
}: {
  year: number;
  month: number;
  basePath?: string;
}) {
  const prev = addMonths(year, month, -1);
  const next = addMonths(year, month, 1);
  const now = new Date();
  const isCurrent = year === now.getFullYear() && month === now.getMonth() + 1;

  const href = (y: number, m: number) => `${basePath}?year=${y}&month=${m}`;
  const btn =
    "inline-flex h-8 items-center rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm hover:bg-[#f2f4f7]";

  return (
    <div className="flex items-center gap-2">
      <Link href={href(prev.year, prev.month)} className={btn} aria-label="Mois précédent">
        ‹
      </Link>
      <span className="min-w-40 text-center text-sm font-semibold text-[var(--foreground)]">
        {formatMonthLabel(year, month)}
      </span>
      <Link href={href(next.year, next.month)} className={btn} aria-label="Mois suivant">
        ›
      </Link>
      {!isCurrent && (
        <Link
          href={href(now.getFullYear(), now.getMonth() + 1)}
          className="ml-1 text-xs font-medium text-[var(--primary)]"
        >
          Revenir au mois en cours
        </Link>
      )}
    </div>
  );
}
