// Single shared admin password (PLAN §"Locked decisions"). Behind this thin
// module so an OIDC provider can replace it later without touching callers.

function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  // compare over the max length so the running time doesn't leak which is longer
  const len = Math.max(ab.length, bb.length, 1);
  let diff = ab.length ^ bb.length;
  for (let i = 0; i < len; i++) diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  return diff === 0;
}

export function adminPasswordConfigured(): boolean {
  return !!process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.length >= 6;
}

export function checkAdminPassword(input: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || expected.length < 6) return false;
  return timingSafeEqual(input, expected);
}
