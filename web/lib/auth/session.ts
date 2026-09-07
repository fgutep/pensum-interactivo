// Signed session cookie for the /administrador panel. Edge-compatible (Web
// Crypto only), so the same module works in middleware and in route handlers.
//
// Token = base64url(JSON payload) + "." + base64url(HMAC-SHA256(payload, SESSION_SECRET)).
// Payload = { sub: "admin", exp: <unix seconds> }.

export const SESSION_COOKIE = "pensum_admin";
export const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12h

interface SessionPayload {
  sub: string;
  exp: number;
}

const enc = new TextEncoder();

function b64urlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(s: string): Uint8Array {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) {
    throw new Error("SESSION_SECRET is missing or too short (>=16 chars)");
  }
  return s;
}

async function sign(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return b64urlEncode(new Uint8Array(sig));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Mint a fresh token valid for SESSION_TTL_SECONDS. */
export async function createSessionToken(): Promise<string> {
  const payload: SessionPayload = {
    sub: "admin",
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  const body = b64urlEncode(enc.encode(JSON.stringify(payload)));
  return `${body}.${await sign(body)}`;
}

/** True when the token's signature checks out and it hasn't expired. */
export async function verifySessionToken(token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return false;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  try {
    if (!timingSafeEqual(sig, await sign(body))) return false;
    const payload = JSON.parse(
      new TextDecoder().decode(b64urlDecode(body))
    ) as SessionPayload;
    return payload.sub === "admin" && payload.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export function sessionCookieOptions(maxAgeSeconds = SESSION_TTL_SECONDS) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSeconds,
  };
}
