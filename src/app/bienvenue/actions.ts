"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { hashPassword, passwordProblem } from "@/lib/auth/password";
import { SESSION_COOKIE, SESSION_MAX_AGE, createSessionToken } from "@/lib/auth/session";

export type SetupState = { error?: string };

export async function setupFirstUser(_prev: SetupState, fd: FormData): Promise<SetupState> {
  if ((await prisma.user.count()) > 0) redirect("/connexion");

  const name = String(fd.get("name") ?? "").trim();
  const password = String(fd.get("password") ?? "");
  const confirm = String(fd.get("confirm") ?? "");

  if (name.length < 2) return { error: "Choisissez un nom d'utilisateur (2 caractères minimum)." };
  const pwProblem = passwordProblem(password);
  if (pwProblem) return { error: pwProblem };
  if (password !== confirm) return { error: "Les deux mots de passe ne correspondent pas." };

  const user = await prisma.user.create({
    data: { name, passwordHash: hashPassword(password), role: "admin" },
  });

  (await cookies()).set(SESSION_COOKIE, await createSessionToken(user.id), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });

  redirect("/");
}
