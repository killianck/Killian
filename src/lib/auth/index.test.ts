import { beforeEach, describe, expect, it, vi } from "vitest";

// getCurrentUser lit le cookie (next/headers) et l'utilisateur (Prisma) : les deux sont simulés.
const state: { token?: string; user: { id: string; name: string; role: string; passwordHash: string } | null } = {
  user: null,
};
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => (state.token ? { value: state.token } : undefined) }),
}));
vi.mock("next/navigation", () => ({ redirect: () => { throw new Error("redirect"); } }));
vi.mock("@/lib/db", () => ({
  prisma: { user: { findUnique: async () => state.user } },
}));

const { getCurrentUser } = await import("./index");
const { createSessionToken } = await import("./session");
const { hashPassword } = await import("./password");

describe("getCurrentUser — révocation des sessions", () => {
  beforeEach(() => {
    state.token = undefined;
    state.user = { id: "u1", name: "admin", role: "admin", passwordHash: hashPassword("motdepasse") };
  });

  it("accepte une session émise avec le mot de passe actuel, sans exposer le hash", async () => {
    state.token = await createSessionToken("u1", state.user!.passwordHash);
    expect(await getCurrentUser()).toEqual({ id: "u1", name: "admin", role: "admin" });
  });

  it("refuse une session émise AVANT un changement de mot de passe", async () => {
    state.token = await createSessionToken("u1", state.user!.passwordHash);
    state.user!.passwordHash = hashPassword("nouveau-mdp"); // changement / auth:reset
    expect(await getCurrentUser()).toBeNull();
  });

  it("refuse une session d'un compte supprimé, ou sans cookie", async () => {
    state.token = await createSessionToken("u1", state.user!.passwordHash);
    state.user = null;
    expect(await getCurrentUser()).toBeNull();
    state.token = undefined;
    expect(await getCurrentUser()).toBeNull();
  });
});
