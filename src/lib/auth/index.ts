// Accès à l'utilisateur connecté depuis les composants et actions serveur.

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { SESSION_COOKIE, passwordFingerprint, verifySessionToken } from "./session";

export type CurrentUser = { id: string; name: string; role: string };

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const claims = await verifySessionToken(token);
  if (!claims) return null;
  const user = await prisma.user.findUnique({
    where: { id: claims.uid },
    select: { id: true, name: true, role: true, passwordHash: true },
  });
  if (!user) return null;
  // Session émise avant un changement/une réinitialisation du mot de passe
  // (ou jeton d'avant l'empreinte) : révoquée.
  if (claims.pv !== (await passwordFingerprint(user.passwordHash))) return null;
  return { id: user.id, name: user.name, role: user.role };
}

/** À utiliser dans une action : renvoie l'utilisateur ou coupe court. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");
  return user;
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "admin") {
    throw new Error("Action réservée à un administrateur.");
  }
  return user;
}

export async function hasAnyUser(): Promise<boolean> {
  return (await prisma.user.count()) > 0;
}
