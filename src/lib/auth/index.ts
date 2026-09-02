// Accès à l'utilisateur connecté depuis les composants et actions serveur.

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { SESSION_COOKIE, verifySessionToken } from "./session";

export type CurrentUser = { id: string; name: string; role: string };

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const uid = await verifySessionToken(token);
  if (!uid) return null;
  const user = await prisma.user.findUnique({
    where: { id: uid },
    select: { id: true, name: true, role: true },
  });
  return user;
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
