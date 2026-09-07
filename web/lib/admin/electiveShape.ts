// Shared coercion helpers for the Elective admin routes.

import type { Prisma } from "@prisma/client";

const ROLE_NORMS = new Set([
  "obligatoria",
  "electiva",
  "area_mayor",
  "curso_integrador",
  "proy_grado",
  "cle",
  "practica",
  "pasantia",
  "maestria",
]);

export function buildRoles(v: unknown): Prisma.InputJsonValue {
  const src = (v ?? {}) as Record<string, { norm?: string | null; raw?: string }>;
  const cell = (k: string) => {
    const c = src[k] ?? {};
    const norm = c.norm && ROLE_NORMS.has(c.norm) ? c.norm : null;
    return { norm, raw: String(c.raw ?? "").trim() };
  };
  return {
    eleFrom2024: cell("eleFrom2024"),
    elcFrom2024: cell("elcFrom2024"),
    eleUntil2023: cell("eleUntil2023"),
    elcUntil2023: cell("elcUntil2023"),
  } as Prisma.InputJsonValue;
}

export function termList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((s) => String(s).trim()).filter(Boolean);
  return String(v ?? "")
    .split(/[,\s;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}
