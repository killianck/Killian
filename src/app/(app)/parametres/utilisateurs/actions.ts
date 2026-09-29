"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { SESSION_COOKIE, SESSION_MAX_AGE, createSessionToken } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { requireAdmin, requireUser } from "@/lib/auth";
import { hashPassword, passwordProblem, verifyPassword } from "@/lib/auth/password";

export type UserActionState = { error?: string; ok?: string };

export async function createUser(_prev: UserActionState, fd: FormData): Promise<UserActionState> {
  await requireAdmin();
  const name = String(fd.get("name") ?? "").trim();
  const password = String(fd.get("password") ?? "");
  const role = fd.get("role") === "admin" ? "admin" : "standard";

  if (name.length < 2) return { error: "Nom trop court." };
  const pb = passwordProblem(password);
  if (pb) return { error: pb };
  if (await prisma.user.findUnique({ where: { name } })) {
    return { error: "Ce nom d'utilisateur existe déjà." };
  }

  await prisma.user.create({ data: { name, passwordHash: hashPassword(password), role } });
  revalidatePath("/parametres/utilisateurs");
  return { ok: `Utilisateur « ${name} » créé.` };
}

/**
 * Supprime un compte.
 *
 * Les refus sont renvoyés à l'écran via `?erreur=` (comme les actions de la
 * fiche facture) et NON en levant une exception : un `throw` dans une action
 * serveur fait tomber la limite d'erreur, et Next MASQUE le message dans une
 * application compilée. L'administrateur voyait donc « Une erreur s'est
 * produite » sans jamais apprendre qu'il s'agissait du dernier administrateur.
 */
export async function deleteUser(id: string): Promise<void> {
  const me = await requireAdmin();
  if (id === me.id) redirect("/parametres/utilisateurs?erreur=soi_meme");

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) redirect("/parametres/utilisateurs?erreur=introuvable");
  const admins = await prisma.user.count({ where: { role: "admin" } });
  if (target.role === "admin" && admins <= 1) {
    redirect("/parametres/utilisateurs?erreur=dernier_admin");
  }

  try {
    await prisma.user.delete({ where: { id } });
  } catch (e) {
    unstable_rethrow(e);
    console.error("Suppression d'utilisateur impossible :", e);
    redirect("/parametres/utilisateurs?erreur=suppression");
  }
  revalidatePath("/parametres/utilisateurs");
}

/**
 * Réinitialisation du mot de passe d'un AUTRE compte par un administrateur.
 * C'est ce que promet la page de connexion (« un administrateur peut le
 * réinitialiser dans Paramètres → Utilisateurs ») ; sans cela, un utilisateur
 * qui oublie son mot de passe ne peut plus entrer qu'en passant par la ligne de
 * commande `npm run auth:reset`.
 *
 * Le nouveau hash change l'empreinte de session : toutes les sessions ouvertes
 * du compte concerné sont révoquées (voir `passwordFingerprint`).
 */
export async function resetUserPassword(_prev: UserActionState, fd: FormData): Promise<UserActionState> {
  const me = await requireAdmin();
  const id = String(fd.get("id") ?? "");
  const next = String(fd.get("next") ?? "");
  const confirm = String(fd.get("confirm") ?? "");

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return { error: "Utilisateur introuvable." };
  // Son propre mot de passe se change avec l'ancien (voir `changePassword`) :
  // ne pas ouvrir ici un contournement de cette vérification.
  if (target.id === me.id) {
    return { error: "Pour votre propre compte, utilisez « Changer mon mot de passe »." };
  }
  const pb = passwordProblem(next);
  if (pb) return { error: pb };
  if (next !== confirm) return { error: "Les deux mots de passe ne correspondent pas." };

  await prisma.user.update({ where: { id }, data: { passwordHash: hashPassword(next) } });
  revalidatePath("/parametres/utilisateurs");
  return {
    ok: `Mot de passe de « ${target.name} » réinitialisé. Ses sessions ouvertes ont été déconnectées.`,
  };
}

export async function changePassword(_prev: UserActionState, fd: FormData): Promise<UserActionState> {
  const me = await requireUser();
  const current = String(fd.get("current") ?? "");
  const next = String(fd.get("next") ?? "");
  const confirm = String(fd.get("confirm") ?? "");

  const user = await prisma.user.findUnique({ where: { id: me.id } });
  if (!user || !verifyPassword(current, user.passwordHash)) {
    return { error: "Mot de passe actuel incorrect." };
  }
  const pb = passwordProblem(next);
  if (pb) return { error: pb };
  if (next !== confirm) return { error: "Les deux nouveaux mots de passe ne correspondent pas." };

  const passwordHash = hashPassword(next);
  await prisma.user.update({ where: { id: me.id }, data: { passwordHash } });
  // Le nouveau hash révoque toutes les sessions existantes de ce compte (autres
  // postes/navigateurs compris) ; on ré-émet celle de l'utilisateur courant.
  (await cookies()).set(SESSION_COOKIE, await createSessionToken(me.id, passwordHash), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return { ok: "Mot de passe modifié. Vos autres sessions ont été déconnectées." };
}
