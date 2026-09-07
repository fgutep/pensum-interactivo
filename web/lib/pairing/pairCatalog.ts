// Pairs a catalog's courses against the live Uniandes offering for a term.
// Pure of the DB: returns a plain result the caller (seed.ts / apply.ts /
// resync route) persists. Never throws for a single course — failures degrade
// to pairingStatus "sync_failed" and never roll back an import.

import {
  urlByCourse,
  sectionCode,
  type FetchOpts,
} from "../shared-oferta/fetcher";
import type {
  CourseDetailsAPI,
  SeccionAPI,
} from "../shared-oferta/ofertaDeCursosAPI";
import type { PlaceholderKind } from "../import/classifyPlaceholder";
import { normalizeCode } from "../import/normalizeCode";
import { parseRequirement } from "../import/requirementParser";
import type { ReqNode } from "../types";
import { OfferingsCache } from "./offeringsCache";
import { suggestForPlaceholder } from "./placeholderHeuristics";

export type PairingStatus =
  | "auto_paired"
  | "not_offered"
  | "needs_manual"
  | "manual_resolved"
  | "placeholder_pool"
  | "sync_failed";

export interface PairInputCourse {
  sortIndex: number;
  normalizedCode: string;
  displayCode: string;
  name: string;
  credits: number;
  semester: number;
  isPlaceholder: boolean;
  placeholderKind?: PlaceholderKind;
  placeholderLabel?: string;
  prereqText?: string | null;
}

export interface OfferingAggregate {
  normalizedCode: string;
  term: string;
  offered: boolean;
  canonicalTitle: string | null;
  canonicalCredits: number | null;
  sectionCount: number;
  seatsAvailableMin: number | null;
  seatsAvailableMax: number | null;
  attrs: string[];
  ptrmSet: string[];
  syncError: string | null;
}

/** One normalized corequisite from /api/courseDetails. */
export interface CoreqDetail {
  subject: string;
  coursenumber: string;
  title: string;
  normalizedCode: string; // "IELE2002L"
}

/** Live prereq/coreq/restrictions for a course, from /api/courseDetails. */
export interface CourseDetailsResult {
  nrc: string;
  prereqText: string | null;
  prereqTree: ReqNode | null;
  coreq: CoreqDetail[];
  coreqTree: ReqNode | null;
  restrictions: { type: string; ind: string; desc: string[] }[];
  compl: unknown[];
  master: unknown[];
  syncError: string | null;
}

export interface CoursePairResult {
  sortIndex: number;
  normalizedCode: string;
  pairingStatus: PairingStatus;
  offering?: OfferingAggregate;
  /** present for auto_paired courses when courseDetails was fetched */
  details?: CourseDetailsResult;
  manual?: { suggestedCode?: string; candidateCodes?: string[] };
}

export interface PairCatalogResult {
  term: string;
  courses: CoursePairResult[];
  apiFailureRate: number;
  aborted: boolean;
}

const toNum = (v: unknown): number => {
  const n = Number.parseFloat(String(v ?? "").trim());
  return Number.isFinite(n) ? n : NaN;
};

function aggregate(code: string, term: string, rows: SeccionAPI[]): OfferingAggregate {
  const byNrc = new Map<string, SeccionAPI>();
  for (const r of rows) byNrc.set(String(r.nrc), r);
  const sections = [...byNrc.values()];

  const attrs = new Set<string>();
  const ptrm = new Set<string>();
  let seatMin = Infinity;
  let seatMax = -Infinity;
  for (const s of sections) {
    for (const a of s.attr ?? []) {
      const c = (a as { code?: string }).code;
      if (c) attrs.add(String(c).toUpperCase());
    }
    const p = String(s.ptrm ?? "").toUpperCase();
    ptrm.add(p === "8A" || p === "8B" ? p : "16");
    const free = toNum(s.maxenrol) - toNum(s.enrolled);
    if (Number.isFinite(free)) {
      seatMin = Math.min(seatMin, free);
      seatMax = Math.max(seatMax, free);
    }
  }
  const first = sections[0];
  return {
    normalizedCode: code,
    term,
    offered: sections.length > 0,
    canonicalTitle: first ? String(first.title ?? "") || null : null,
    canonicalCredits: first ? (Number.isFinite(toNum(first.credits)) ? toNum(first.credits) : null) : null,
    sectionCount: sections.length,
    seatsAvailableMin: Number.isFinite(seatMin) ? seatMin : null,
    seatsAvailableMax: Number.isFinite(seatMax) ? seatMax : null,
    attrs: [...attrs].sort(),
    ptrmSet: [...ptrm].sort(),
    syncError: null,
  };
}

/** AND of the given course codes as a requirement tree (null when empty). */
function andTree(codes: string[]): ReqNode | null {
  const uniq = [...new Set(codes.filter(Boolean))];
  if (uniq.length === 0) return null;
  const items: ReqNode[] = uniq.map((code) => ({ op: "COURSE", code }));
  return items.length === 1 ? items[0] : { op: "AND", items };
}

/** Shape a raw courseDetails response into what persistCatalog stores. */
function toDetailsResult(nrc: string, d: CourseDetailsAPI): CourseDetailsResult {
  const prereqText = (d.prereq[0]?.code ?? "").trim() || null;
  const coreq: CoreqDetail[] = d.coreq.map((c) => ({
    subject: String(c.subject ?? "").trim(),
    coursenumber: String(c.coursenumber ?? "").trim(),
    title: String(c.title ?? "").trim(),
    normalizedCode: normalizeCode(`${c.subject ?? ""}${c.coursenumber ?? ""}`),
  }));
  return {
    nrc,
    prereqText,
    prereqTree: parseRequirement(prereqText),
    coreq,
    coreqTree: andTree(coreq.map((c) => c.normalizedCode)),
    restrictions: d.restr.map((r) => ({
      type: String(r.type ?? ""),
      ind: String(r.ind ?? ""),
      desc: Array.isArray(r.desc) ? r.desc.map(String) : [],
    })),
    compl: d.compl ?? [],
    master: d.master ?? [],
    syncError: null,
  };
}

/** tiny concurrency limiter */
function pLimit(concurrency: number) {
  let active = 0;
  const queue: (() => void)[] = [];
  const next = () => {
    active--;
    queue.shift()?.();
  };
  return function run<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const exec = () => {
        active++;
        fn().then(resolve, reject).finally(next);
      };
      if (active < concurrency) exec();
      else queue.push(exec);
    });
  };
}

export async function pairCatalog(
  courses: PairInputCourse[],
  term: string,
  opts: {
    concurrency?: number;
    fetchOpts?: FetchOpts;
    programCode?: string;
    /** share a cache across several catalogs in one run (e.g. seeding all 5) */
    cache?: OfferingsCache;
    /** also pull /api/courseDetails (prereq/coreq/restrictions) per auto-paired
     * course — the live source of truth for requirements (default true) */
    fetchDetails?: boolean;
  } = {}
): Promise<PairCatalogResult> {
  const concurrency = opts.concurrency ?? Number(process.env.PAIRING_CONCURRENCY ?? 4) ?? 4;
  const limit = pLimit(Math.max(1, concurrency));
  const cache = opts.cache ?? new OfferingsCache();
  const programCode = opts.programCode ?? "IELE";
  const fetchDetails = opts.fetchDetails !== false;

  let fetches = 0;
  let failures = 0;
  let aborted = false;

  const real = courses.filter((c) => !c.isPlaceholder);
  const placeholders = courses.filter((c) => c.isPlaceholder);
  const results: CoursePairResult[] = [];

  await Promise.all(
    real.map((c) =>
      limit(async (): Promise<void> => {
        if (aborted) {
          results.push({
            sortIndex: c.sortIndex,
            normalizedCode: c.normalizedCode,
            pairingStatus: "sync_failed",
          });
          return;
        }
        fetches++;
        try {
          const grouped = await cache.fetchGrouped(
            urlByCourse(c.normalizedCode, term),
            opts.fetchOpts
          );
          const rows =
            grouped.get(c.normalizedCode) ??
            // some responses key slightly differently; match by sectionCode too
            [...grouped.values()].flat().filter((s) => sectionCode(s) === c.normalizedCode);

          if (rows.length > 0) {
            const res: CoursePairResult = {
              sortIndex: c.sortIndex,
              normalizedCode: c.normalizedCode,
              pairingStatus: "auto_paired",
              offering: aggregate(c.normalizedCode, term, rows),
            };
            const rep = rows[0];
            const nrc = String(rep?.nrc ?? "").trim();
            const ptrm = String(rep?.ptrm ?? "").trim() || "1";
            if (fetchDetails && !aborted && nrc) {
              try {
                const d = await cache.courseDetails(term, ptrm, nrc, opts.fetchOpts);
                if (d) res.details = toDetailsResult(nrc, d);
              } catch (err) {
                // details are best-effort — the course stays auto_paired, we just
                // fall back to the Excel-derived requirement trees.
                res.details = {
                  nrc,
                  prereqText: null,
                  prereqTree: null,
                  coreq: [],
                  coreqTree: null,
                  restrictions: [],
                  compl: [],
                  master: [],
                  syncError: err instanceof Error ? err.message : String(err),
                };
              }
            }
            results.push(res);
          } else {
            results.push({
              sortIndex: c.sortIndex,
              normalizedCode: c.normalizedCode,
              pairingStatus: "not_offered",
              offering: {
                normalizedCode: c.normalizedCode,
                term,
                offered: false,
                canonicalTitle: null,
                canonicalCredits: null,
                sectionCount: 0,
                seatsAvailableMin: null,
                seatsAvailableMax: null,
                attrs: [],
                ptrmSet: [],
                syncError: null,
              },
            });
          }
        } catch (err) {
          failures++;
          results.push({
            sortIndex: c.sortIndex,
            normalizedCode: c.normalizedCode,
            pairingStatus: "sync_failed",
            offering: {
              normalizedCode: c.normalizedCode,
              term,
              offered: false,
              canonicalTitle: null,
              canonicalCredits: null,
              sectionCount: 0,
              seatsAvailableMin: null,
              seatsAvailableMax: null,
              attrs: [],
              ptrmSet: [],
              syncError: err instanceof Error ? err.message : String(err),
            },
          });
          if (fetches >= 6 && failures / fetches > 0.5) aborted = true;
        }
      })
    )
  );

  // placeholders: run heuristics sequentially (few of them, and they reuse the cache)
  for (const c of placeholders) {
    if (aborted || !c.placeholderKind) {
      results.push({
        sortIndex: c.sortIndex,
        normalizedCode: c.normalizedCode,
        pairingStatus: "needs_manual",
      });
      continue;
    }
    const h = await suggestForPlaceholder({
      kind: c.placeholderKind,
      displayCode: c.displayCode,
      label: c.placeholderLabel ?? c.name,
      programCode,
      term,
      cache,
      fetchOpts: opts.fetchOpts,
    });
    results.push({
      sortIndex: c.sortIndex,
      normalizedCode: c.normalizedCode,
      pairingStatus: h.status,
      manual: { suggestedCode: h.suggestedCode, candidateCodes: h.candidateCodes },
    });
  }

  results.sort((a, b) => a.sortIndex - b.sortIndex);
  return {
    term,
    courses: results,
    apiFailureRate: fetches ? failures / fetches : 0,
    aborted,
  };
}
