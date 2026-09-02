"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, isActive } from "./nav";

/** Barre de navigation affichée uniquement sur petit écran (< md). */
export function MobileNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--surface)] md:hidden">
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-sm font-semibold">Facturation &amp; TVA</span>
      </div>
      <nav className="flex gap-1 overflow-x-auto px-2 pb-2">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm ${
              isActive(pathname, item.href)
                ? "bg-[var(--primary)] text-white"
                : "text-[var(--foreground)] bg-[#f2f4f7]"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
