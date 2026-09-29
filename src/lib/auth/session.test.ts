import { describe, expect, it } from "vitest";
import { createSessionToken, passwordFingerprint, verifySessionToken } from "./session";
import { hashPassword } from "./password";

describe("jeton de session", () => {
  it("porte l'identifiant et l'empreinte du mot de passe", async () => {
    const hash = hashPassword("motdepasse");
    const claims = await verifySessionToken(await createSessionToken("u1", hash));
    expect(claims).toEqual({ uid: "u1", pv: await passwordFingerprint(hash) });
  });

  it("un changement de mot de passe change l'empreinte (révocation des sessions)", async () => {
    // Même mot de passe re-haché : nouveau sel => les anciens jetons ne correspondent plus.
    const before = hashPassword("motdepasse");
    const after = hashPassword("motdepasse");
    const claims = await verifySessionToken(await createSessionToken("u1", before));
    expect(claims?.pv).toBe(await passwordFingerprint(before));
    expect(claims?.pv).not.toBe(await passwordFingerprint(after));
  });

  it("l'empreinte ne contient pas le hash du mot de passe", async () => {
    const hash = hashPassword("motdepasse");
    const token = await createSessionToken("u1", hash);
    const payload = Buffer.from(token.split(".")[0], "base64url").toString();
    expect(payload).not.toContain(hash.split("$")[1]);
    expect(payload).not.toContain(hash.split("$")[2].slice(0, 16));
  });

  it("refuse un jeton altéré, tronqué ou vide", async () => {
    const token = await createSessionToken("u1", hashPassword("motdepasse"));
    const [payload, sig] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ uid: "admin", pv: "x", exp: 9e9 })).toString("base64url");
    expect(await verifySessionToken(`${forged}.${sig}`)).toBeNull();
    expect(await verifySessionToken(`${payload}.`)).toBeNull();
    expect(await verifySessionToken(payload)).toBeNull();
    expect(await verifySessionToken("")).toBeNull();
    expect(await verifySessionToken(undefined)).toBeNull();
  });

  it("un jeton d'avant l'empreinte (sans pv) est lu avec pv=null, donc révoqué par getCurrentUser", async () => {
    // Reproduit l'ancien format signé par le même secret.
    const payload = Buffer.from(JSON.stringify({ uid: "u1", exp: Math.floor(Date.now() / 1000) + 60 })).toString(
      "base64url",
    );
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(process.env.AUTH_SECRET || "dev-secret-non-securise-a-changer"),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sig = Buffer.from(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload))).toString(
      "base64url",
    );
    expect(await verifySessionToken(`${payload}.${sig}`)).toEqual({ uid: "u1", pv: null });
  });
});
