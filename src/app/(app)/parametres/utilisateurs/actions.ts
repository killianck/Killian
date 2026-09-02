"use server";

import { revalidatePath } from "next/cache";
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

export async function deleteUser(id: string): Promise<void> {
  const me = await requireAdmin();
  if (id === me.id) throw new Error("Vous ne pouvez pas supprimer votre propre compte.");
  const admins = await prisma.user.count({ where: { role: "admin" } });
  const target = await prisma.user.findUnique({ where: { id } });
  if (target?.role === "admin" && admins <= 1) {
    throw new Error("Impossible de supprimer le dernier administrateur.");
  }
  await prisma.user.delete({ where: { id } });
  revalidatePath("/parametres/utilisateurs");
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

  await prisma.user.update({ where: { id: me.id }, data: { passwordHash: hashPassword(next) } });
  return { ok: "Mot de passe modifié." };
}
