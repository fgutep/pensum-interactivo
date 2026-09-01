// Lifted verbatim from app/scripts/build-data.mjs (normalizeCode).
// "IELE 2100" -> "IELE2100", "MATE-1207*" -> "MATE1207*" (caller strips the *).

export function normalizeCode(raw: unknown): string {
  return String(raw || "")
    .toUpperCase()
    .replace(/[^A-Z0-9ÑÁÉÍÓÚ]/g, "");
}
