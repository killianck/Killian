// Jeton de session signé (HMAC-SHA256 via Web Crypto — fonctionne aussi bien
// dans le middleware que dans les composants serveur).
//
// Format du cookie : "<payloadBase64url>.<signatureBase64url>"
// payload = JSON { uid, exp }

export const SESSION_COOKIE = "fv_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 14; // 14 jours

function secret(): string {
  return process.env.AUTH_SECRET || "dev-secret-non-securise-a-changer";
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

export async function createSessionToken(userId: string): Promise<string> {
  const payload = b64urlFromBytes(
    enc.encode(JSON.stringify({ uid: userId, exp: Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS })),
  );
  return `${payload}.${await hmac(payload)}`;
}

export async function verifySessionToken(token: string | undefined | null): Promise<string | null> {
  if (!token || !token.includes(".")) return null;
  const [payload, sig] = token.split(".");
  if ((await hmac(payload)) !== sig) return null;
  try {
    const { uid, exp } = JSON.parse(new TextDecoder().decode(bytesFromB64url(payload)));
    if (typeof uid !== "string" || typeof exp !== "number" || exp * 1000 < Date.now()) return null;
    return uid;
  } catch {
    return null;
  }
}

export const SESSION_MAX_AGE = MAX_AGE_SECONDS;
