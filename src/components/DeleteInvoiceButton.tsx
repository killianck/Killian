"use client";

const INVOICE_CONFIRM =
  "Supprimer cette facture ?\n\nElle sera retirée de tous les calculs. " +
  "Le PDF d'origine ne sera pas effacé : il sera déplacé dans le dossier « data/corbeille ».";

export function DeleteInvoiceButton({
  action,
  variant = "button",
  confirmText = INVOICE_CONFIRM,
  label = "Supprimer la facture",
}: {
  action: () => Promise<void>;
  variant?: "button" | "icon";
  confirmText?: string;
  label?: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(confirmText)) e.preventDefault();
      }}
    >
      {variant === "icon" ? (
        <button
          type="submit"
          title={label}
          aria-label={label}
          className="rounded-md px-1.5 py-1 text-[var(--muted)] hover:bg-[var(--danger-bg)] hover:text-[var(--danger)]"
        >
          🗑
        </button>
      ) : (
        <button
          type="submit"
          className="rounded-lg border border-[var(--danger-bg)] px-3 py-1.5 text-xs font-medium text-[var(--danger)] hover:bg-[var(--danger-bg)]"
        >
          {label}
        </button>
      )}
    </form>
  );
}
