"use client";

export function DeleteInvoiceButton({ action }: { action: () => Promise<void> }) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (
          !window.confirm(
            "Supprimer cette facture ?\n\nElle sera retirée de tous les calculs. " +
              "Le PDF d'origine ne sera pas effacé : il sera déplacé dans le dossier « data/corbeille ».",
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <button
        type="submit"
        className="rounded-lg border border-[var(--danger-bg)] px-3 py-1.5 text-xs font-medium text-[var(--danger)] hover:bg-[var(--danger-bg)]"
      >
        Supprimer la facture
      </button>
    </form>
  );
}
