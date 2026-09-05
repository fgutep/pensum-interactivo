// Best-effort suggestions for pensum slots that can't 1:1 match a course code.
// These only *suggest* — everything lands in the manual-pairing queue for a
// coordinator to confirm or override.

import type { PlaceholderKind } from "../import/classifyPlaceholder";
import { normalizeCode } from "../import/normalizeCode";
import {
  urlByPrefix,
  programasEspeciales,
  sectionCode,
  type FetchOpts,
} from "../shared-oferta/fetcher";
import type { OfferingsCache } from "./offeringsCache";
import { tokenSetRatio } from "../import/textMatch";

export interface HeuristicResult {
  suggestedCode?: string;
  candidateCodes?: string[];
  /** final pairing status for the slot */
  status: "needs_manual" | "placeholder_pool";
}

const prefixFromDisplay = (displayCode: string): string | null => {
  const m = /^([A-Za-zÑñ]{2,6})\b/.exec(displayCode.trim());
  return m ? m[1].toUpperCase() : null;
};

export async function suggestForPlaceholder(params: {
  kind: PlaceholderKind;
  displayCode: string;
  label: string;
  programCode: string;
  term: string;
  cache: OfferingsCache;
  fetchOpts?: FetchOpts;
}): Promise<HeuristicResult> {
  const { kind, displayCode, label, programCode, term, cache, fetchOpts } = params;
  const deptPrefix = programCode === "IELC" ? "IELE" : "IELE"; // both electrical & electronics live under IELE

  try {
    if (kind === "CBU") {
      const codes = new Set<string>();
      for (const p of programasEspeciales) {
        const g = await cache.fetchGrouped(urlByPrefix(p, term), fetchOpts);
        for (const k of g.keys()) codes.add(k);
      }
      return { candidateCodes: [...codes].sort().slice(0, 200), status: "placeholder_pool" };
    }

    if (kind === "ELECTIVA" || kind === "EFI") {
      const g = await cache.fetchGrouped(urlByPrefix(deptPrefix, term), fetchOpts);
      const candidates = [...g.keys()].sort();
      return {
        candidateCodes: candidates.slice(0, 200),
        status: candidates.length ? "placeholder_pool" : "needs_manual",
      };
    }

    if (kind === "CLE") {
      // libre elección = anything; no useful automatic pool
      return { status: "needs_manual" };
    }

    // DEPT / CODEX / CI — we have a real course name; fuzzy-match it against API titles
    const prefix = prefixFromDisplay(displayCode) ?? deptPrefix;
    const rows = await cache.fetch(urlByPrefix(prefix, term), fetchOpts);
    let best: { code: string; score: number } | null = null;
    const seen = new Set<string>();
    for (const s of rows) {
      const code = sectionCode(s);
      if (seen.has(code)) continue;
      seen.add(code);
      const score = tokenSetRatio(label, s.title ?? "");
      if (!best || score > best.score) best = { code, score };
    }
    if (best && best.score >= 0.5) return { suggestedCode: best.code, status: "needs_manual" };
    return { status: "needs_manual" };
  } catch {
    return { status: "needs_manual" };
  }
}

export { normalizeCode };
