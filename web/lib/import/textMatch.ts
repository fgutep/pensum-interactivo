// Small accent-folding + fuzzy-name helpers shared by the pairing heuristics and
// the electives import. Kept dependency-free.

/** Uppercase + strip diacritics. */
export function foldAccents(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toUpperCase();
}

/** token-set overlap ratio in [0,1] */
export function tokenSetRatio(a: string, b: string): number {
  const ta = new Set(foldAccents(a).split(/[^A-Z0-9]+/).filter((t) => t.length > 2));
  const tb = new Set(foldAccents(b).split(/[^A-Z0-9]+/).filter((t) => t.length > 2));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / Math.max(ta.size, tb.size);
}

/** Canonical key for a long course name: folded, punctuation-stripped, space-collapsed. */
export function normalizeName(s: string): string {
  return foldAccents(s)
    .replace(/[^A-Z0-9ÑÁÉÍÓÚ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
