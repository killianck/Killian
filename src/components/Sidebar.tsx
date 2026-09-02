"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Tableau de bord", icon: "▚" },
  { href: "/factures", label: "Factures", icon: "▤" },
  { href: "/echeances", label: "Échéances", icon: "◷" },
  { href: "/tva", label: "TVA", icon: "%" },
  { href: "/rapports", label: "Rapports", icon: "▦" },
  { href: "/parametres", label: "Paramètres", icon: "⚙" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 shrink-0 border-r border-[var(--border)] bg-[var(--surface)] px-3 py-6 hidden md:flex md:flex-col">
      <div className="px-3 pb-6">
        <p className="text-sm font-semibold text-[var(--foreground)]">Facturation &amp; TVA</p>
        <p className="text-xs text-[var(--muted)]">Suivi de l&apos;entreprise</p>
      </div>
      <nav className="flex flex-col gap-1">
        {NAV.map((item) => {
          const active =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-[var(--primary)] text-white"
                  : "text-[var(--foreground)] hover:bg-[#f2f4f7]"
              }`}
            >
              <span className="w-4 text-center opacity-80">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto px-3 pt-6 text-[11px] leading-relaxed text-[var(--muted)]">
        Outil de suivi. Ne remplace pas un expert-comptable.
      </div>
    </aside>
  );
}
