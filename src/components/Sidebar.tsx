"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, isActive } from "./nav";
import { logout } from "@/lib/auth/actions";

export function Sidebar({ user }: { user: { name: string; role: string } }) {
  const pathname = usePathname();

  return (
    <aside className="w-60 shrink-0 border-r border-[var(--border)] bg-[var(--surface)] px-3 py-6 hidden md:flex md:flex-col">
      <div className="px-3 pb-6">
        <p className="text-sm font-semibold text-[var(--foreground)]">Facturation &amp; TVA</p>
        <p className="text-xs text-[var(--muted)]">Suivi de l&apos;entreprise</p>
      </div>
      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
              isActive(pathname, item.href)
                ? "bg-[var(--primary)] text-white"
                : "text-[var(--foreground)] hover:bg-[#f2f4f7]"
            }`}
          >
            <span className="w-4 text-center opacity-80">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="mt-auto px-3 pt-6">
        <p className="text-xs font-medium text-[var(--foreground)]">{user.name}</p>
        <p className="text-[11px] text-[var(--muted)]">
          {user.role === "admin" ? "Administrateur" : "Utilisateur"}
        </p>
        <form action={logout} className="mt-2">
          <button className="text-xs font-medium text-[var(--primary)]">Se déconnecter</button>
        </form>
        <p className="mt-4 text-[11px] leading-relaxed text-[var(--muted)]">
          Outil de suivi. Ne remplace pas un expert-comptable.
        </p>
      </div>
    </aside>
  );
}
