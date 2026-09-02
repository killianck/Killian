export const NAV_ITEMS = [
  { href: "/", label: "Tableau de bord", icon: "▚" },
  { href: "/factures", label: "Factures", icon: "▤" },
  { href: "/tiers", label: "Tiers", icon: "◑" },
  { href: "/echeances", label: "Échéances", icon: "◷" },
  { href: "/tva", label: "TVA", icon: "%" },
  { href: "/rapports", label: "Rapports", icon: "▦" },
  { href: "/parametres", label: "Paramètres", icon: "⚙" },
] as const;

export function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}
