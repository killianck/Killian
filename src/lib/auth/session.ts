// Jeton de session signé (HMAC-SHA256 via Web Crypto — fonctionne aussi bien
// dans le middleware que dans les composants serveur).
//
// Format du cookie : "<payloadBase64url>.<signatureBase64url>"
// payload = JSON { uid, exp }

export const SESSION_COOKIE = "fv_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 14; // 14 jours

const DEV_SECRET = "dev-secret-non-securise-a-changer";

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (process.env.NODE_ENV === "production" && (!s || s === DEV_SECRET)) {
    // En production, un secret par défaut rendrait les sessions falsifiables.
    throw new Error("AUTH_SECRET manquant : configuration de sécurité invalide.");
  }
  return s || DEV_SECRET;
}

const enc = new TextEncoder();

function b64urlFromBytes(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const b of arr) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function bytesFromB64url(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return b64urlFromBytes(sig);
}

/**
 * Empreinte du mot de passe embarquée dans le jeton. Le jeton étant sans état,
 * c'est ce qui permet de RÉVOQUER les sessions : un changement ou une
 * réinitialisation du mot de passe (nouveau sel => nouveau hash) change
 * l'empreinte, et les anciens jetons sont refusés par `getCurrentUser`.
 * HMAC avec le secret : le cookie ne révèle rien du hash.
 */
export async function passwordFingerprint(passwordHash: string): Promise<string> {
  return (await hmac(`pv:${passwordHash}`)).slice(0, 22);
}

export async function createSessionToken(userId: string, passwordHash: string): Promise<string> {
  const payload = b64urlFromBytes(
    enc.encode(
      JSON.stringify({
        uid: userId,
        pv: await passwordFingerprint(passwordHash),
        exp: Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS,
      }),
    ),
  );
  return `${payload}.${await hmac(payload)}`;
}

export type SessionClaims = { uid: string; pv: string | null };

/** Comparaison à temps constant de deux chaînes base64url. */
function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Vérifie signature et expiration. Ne consulte PAS la base (utilisable dans le
 * proxy) : l'empreinte `pv` est contrôlée par `getCurrentUser`.
 */
export async function verifySessionToken(token: string | undefined | null): Promise<SessionClaims | null> {
  if (!token || !token.includes(".")) return null;
  const [payload, sig] = token.split(".");
  if (!sig || !timingSafeEqualStr(await hmac(payload), sig)) return null;
  try {
    const { uid, pv, exp } = JSON.parse(new TextDecoder().decode(bytesFromB64url(payload)));
    if (typeof uid !== "string" || typeof exp !== "number" || exp * 1000 < Date.now()) return null;
    return { uid, pv: typeof pv === "string" ? pv : null };
  } catch {
    return null;
  }
}

export const SESSION_MAX_AGE = MAX_AGE_SECONDS;
