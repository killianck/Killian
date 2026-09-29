// Réinitialisation d'un mot de passe oublié par un administrateur.
// Prisma, l'authentification et les caches Next sont simulés : on teste les
// règles de l'action, pas la base.

import { beforeEach, describe, expect, it, vi } from "vitest";

type FakeUser = { id: string; name: string; role: string; passwordHash: string };

const state: { me: { id: string; name: string; role: string }; users: FakeUser[] } = {
  me: { id: "admin1", name: "admin", role: "admin" },
  users: [],
};

vi.mock("next/headers", () => ({ cookies: async () => ({ set: () => {} }) }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
// `redirect()` lève dans Next : on simule ce comportement et on retient la cible.
class RedirectError extends Error {
  constructor(public url: string) { super("NEXT_REDIRECT"); }
}
vi.mock("next/navigation", () => ({
  redirect: (url: string) => { throw new RedirectError(url); },
  unstable_rethrow: (e: unknown) => { if (e instanceof RedirectError) throw e; },
}));
vi.mock("@/lib/auth", () => ({
  requireAdmin: async () => {
    if (state.me.role !== "admin") throw new Error("interdit");
    return state.me;
  },
  requireUser: async () => state.me,
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: async ({ where }: { where: { id?: string; name?: string } }) =>
        state.users.find((u) => (where.id ? u.id === where.id : u.name === where.name)) ?? null,
      update: async ({ where, data }: { where: { id: string }; data: Partial<FakeUser> }) => {
        const u = state.users.find((x) => x.id === where.id)!;
        Object.assign(u, data);
        return u;
      },
      count: async ({ where }: { where: { role: string } }) =>
        state.users.filter((u) => u.role === where.role).length,
      delete: async ({ where }: { where: { id: string } }) => {
        const i = state.users.findIndex((u) => u.id === where.id);
        return state.users.splice(i, 1)[0];
      },
    },
  },
}));

const { resetUserPassword, deleteUser } = await import("./actions");
const { hashPassword, verifyPassword } = await import("@/lib/auth/password");
const { passwordFingerprint } = await import("@/lib/auth/session");

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.append(k, v);
  return f;
}

describe("resetUserPassword", () => {
  beforeEach(() => {
    state.me = { id: "admin1", name: "admin", role: "admin" };
    state.users = [
      { id: "admin1", name: "admin", role: "admin", passwordHash: hashPassword("motdepasse-admin") },
      { id: "u2", name: "sophie", role: "standard", passwordHash: hashPassword("ancien-mot-de-passe") },
    ];
  });

  it("réinitialise le mot de passe d'un autre compte", async () => {
    const res = await resetUserPassword({}, fd({ id: "u2", next: "nouveau-mot-de-passe", confirm: "nouveau-mot-de-passe" }));
    expect(res.error).toBeUndefined();
    expect(res.ok).toContain("sophie");

    const sophie = state.users.find((u) => u.id === "u2")!;
    expect(verifyPassword("nouveau-mot-de-passe", sophie.passwordHash)).toBe(true);
    expect(verifyPassword("ancien-mot-de-passe", sophie.passwordHash)).toBe(false);
  });

  it("révoque les sessions ouvertes du compte réinitialisé", async () => {
    const avant = await passwordFingerprint(state.users.find((u) => u.id === "u2")!.passwordHash);
    await resetUserPassword({}, fd({ id: "u2", next: "nouveau-mot-de-passe", confirm: "nouveau-mot-de-passe" }));
    const apres = await passwordFingerprint(state.users.find((u) => u.id === "u2")!.passwordHash);
    // L'empreinte portée par les jetons déjà émis ne correspond plus : getCurrentUser les refusera.
    expect(apres).not.toBe(avant);
  });

  it("refuse un non-administrateur", async () => {
    state.me = { id: "u2", name: "sophie", role: "standard" };
    await expect(
      resetUserPassword({}, fd({ id: "admin1", next: "nouveau-mot-de-passe", confirm: "nouveau-mot-de-passe" })),
    ).rejects.toThrow();
  });

  it("refuse de servir de contournement pour son PROPRE compte (ancien mot de passe non demandé)", async () => {
    const res = await resetUserPassword({}, fd({ id: "admin1", next: "nouveau-mot-de-passe", confirm: "nouveau-mot-de-passe" }));
    expect(res.error).toMatch(/Changer mon mot de passe/);
    expect(verifyPassword("motdepasse-admin", state.users[0].passwordHash)).toBe(true);
  });

  it("refuse deux saisies différentes, un mot de passe trop faible, un compte inconnu", async () => {
    const mismatch = await resetUserPassword({}, fd({ id: "u2", next: "nouveau-mot-de-passe", confirm: "autre-chose-encore" }));
    expect(mismatch.error).toMatch(/ne correspondent pas/);

    const faible = await resetUserPassword({}, fd({ id: "u2", next: "abc", confirm: "abc" }));
    expect(faible.error).toBeTruthy();

    const inconnu = await resetUserPassword({}, fd({ id: "zzz", next: "nouveau-mot-de-passe", confirm: "nouveau-mot-de-passe" }));
    expect(inconnu.error).toMatch(/introuvable/);

    // Aucun de ces refus ne doit avoir touché au compte.
    expect(verifyPassword("ancien-mot-de-passe", state.users[1].passwordHash)).toBe(true);
  });
});

describe("deleteUser", () => {
  beforeEach(() => {
    state.me = { id: "admin1", name: "admin", role: "admin" };
    state.users = [
      { id: "admin1", name: "admin", role: "admin", passwordHash: hashPassword("motdepasse-admin") },
      { id: "u2", name: "sophie", role: "standard", passwordHash: hashPassword("x-mot-de-passe") },
    ];
  });

  /** Exécute l'action et renvoie l'URL de redirection, ou null si elle a abouti. */
  async function redirectOf(id: string): Promise<string | null> {
    try {
      await deleteUser(id);
      return null;
    } catch (e) {
      if (e instanceof RedirectError) return e.url;
      throw e;
    }
  }

  it("supprime un compte ordinaire", async () => {
    expect(await redirectOf("u2")).toBeNull();
    expect(state.users.map((u) => u.id)).toEqual(["admin1"]);
  });

  // Régression : ces trois refus levaient un `Error` brut. Next MASQUE le message
  // dans une application compilée -> l'administrateur voyait « Une erreur s'est
  // produite », sans jamais apprendre POURQUOI. Ils passent par `?erreur=`.
  it("refuse le dernier administrateur avec un motif lisible", async () => {
    // Sophie est admin et tente de supprimer le SEUL autre administrateur.
    state.me = { id: "u2", name: "sophie", role: "admin" };
    state.users = [
      { id: "admin1", name: "admin", role: "admin", passwordHash: hashPassword("motdepasse-admin") },
    ];

    expect(await redirectOf("admin1")).toBe("/parametres/utilisateurs?erreur=dernier_admin");
    expect(state.users).toHaveLength(1);
  });

  it("refuse la suppression de son propre compte", async () => {
    expect(await redirectOf("admin1")).toBe("/parametres/utilisateurs?erreur=soi_meme");
    expect(state.users).toHaveLength(2);
  });

  it("signale un compte déjà supprimé au lieu de lever", async () => {
    expect(await redirectOf("inconnu")).toBe("/parametres/utilisateurs?erreur=introuvable");
  });

  it("refuse un non-administrateur", async () => {
    state.me = { id: "u2", name: "sophie", role: "standard" };
    await expect(deleteUser("admin1")).rejects.toThrow();
  });
});
