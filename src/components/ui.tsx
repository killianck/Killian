import type { ReactNode } from "react";
import { COHERENCE_LEVELS, STATUSES, type CoherenceLevel, type Status } from "@/lib/domain/enums";
import { formatMoney } from "@/lib/format";

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold text-[var(--foreground)]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-[var(--muted)]">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-[var(--border)] bg-[var(--surface)] ${className}`}>
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "positive" | "negative";
}) {
  const valueColor =
    tone === "positive" ? "text-[var(--success)]" : tone === "negative" ? "text-[var(--danger)]" : "text-[var(--foreground)]";
  return (
    <Card className="p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">{label}</p>
      <p className={`mt-2 text-2xl font-semibold tabular-nums ${valueColor}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-[var(--muted)]">{hint}</p>}
    </Card>
  );
}

export function Money({ value, currency = "EUR" }: { value: number | null | undefined; currency?: string }) {
  return <span className="tabular-nums">{formatMoney(value, currency)}</span>;
}

type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info";

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: BadgeTone }) {
  const styles: Record<BadgeTone, string> = {
    neutral: "bg-[#f2f4f7] text-[var(--muted)]",
    success: "bg-[var(--success-bg)] text-[var(--success)]",
    warning: "bg-[var(--warning-bg)] text-[var(--warning)]",
    danger: "bg-[var(--danger-bg)] text-[var(--danger)]",
    info: "bg-[#eff4ff] text-[var(--primary)]",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${styles[tone]}`}>
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const tone: BadgeTone =
    status === "validee" ? "success" : status === "erreur" ? "danger" : status === "a_verifier" ? "warning" : "neutral";
  return <Badge tone={tone}>{STATUSES[status as Status] ?? status}</Badge>;
}

export function CoherenceBadge({ level }: { level: string }) {
  const tone: BadgeTone =
    level === "coherent" ? "success" : level === "incoherent" ? "danger" : "warning";
  return <Badge tone={tone}>{COHERENCE_LEVELS[level as CoherenceLevel] ?? level}</Badge>;
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <Card className="p-10 text-center text-sm text-[var(--muted)]">{children}</Card>
  );
}

export function Disclaimer({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-[var(--warning-bg)] bg-[var(--warning-bg)] px-3 py-2 text-xs text-[var(--warning)]">
      {children}
    </p>
  );
}
