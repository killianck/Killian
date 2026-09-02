"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { SESSION_COOKIE, SESSION_MAX_AGE, createSessionToken } from "@/lib/auth/session";

export type LoginState = { error?: string };

export async function login(_prev: LoginState, fd: FormData): Promise<LoginState> {
  const name = String(fd.get("name") ?? "").trim();
  const password = String(fd.get("password") ?? "");
  const suite = String(fd.get("suite") ?? "/") || "/";

  if (!name || !password) return { error: "Nom d'utilisateur et mot de passe requis." };

  const user = await prisma.user.findUnique({ where: { name } });
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return { error: "Nom d'utilisateur ou mot de passe incorrect." };
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  (await cookies()).set(SESSION_COOKIE, await createSessionToken(user.id), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });

  redirect(suite.startsWith("/") ? suite : "/");
}
