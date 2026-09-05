// Writes one ParsedCatalog (+ prereq text + pairing results) into the DB.
// Used by scripts/seed.ts and by lib/import/apply.ts (the latter wraps this in a
// snapshot + import-job transaction).

import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import type { ParsedCatalog, ParsedCourse } from "./parsePensumWorkbook";
import type { PrereqRow } from "./parsePrereqExport";
import { parseRequirement } from "./requirementParser";
import { pairCatalog, type CoursePairResult, type PairInputCourse } from "../pairing/pairCatalog";
import type { OfferingsCache } from "../pairing/offeringsCache";

export interface PersistOptions {
  status?: "draft" | "published" | "archived";
  term: string;
  sourceFilename?: string;
  /** run live API pairing after writing courses (default true) */
  pair?: boolean;
  concurrency?: number;
  /** share an offerings cache across several persist calls in one run */
  cache?: OfferingsCache;
  /** presentation identity written onto the Catalog row */
  identity?: {
    accentColor?: string | null;
    tagline?: string | null;
    subtitle?: string | null;
    imagePath?: string | null;
  };
  /** admin progression rules ({ gates, attestations }) written onto Catalog.rules */
  rules?: unknown;
}

export interface PersistResult {
  slug: string;
  catalogId: number;
  courseCount: number;
  pairing: {
    auto_paired: number;
    not_offered: number;
    needs_manual: number;
    placeholder_pool: number;
    sync_failed: number;
    manual_resolved: number;
  };
  apiFailureRate: number;
}

function toInputJson(v: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  return v == null ? (undefined as never) : (v as Prisma.InputJsonValue);
}

export async function persistParsedCatalog(
  parsed: ParsedCatalog,
  prereqMap: Map<string, PrereqRow>,
  opts: PersistOptions
): Promise<PersistResult> {
  const status = opts.status ?? "draft";
  const identity = opts.identity ?? {};

  // 1. upsert the Catalog row
  const catalog = await prisma.catalog.upsert({
    where: { slug: parsed.slug },
    create: {
      slug: parsed.slug,
      programCode: parsed.programCode,
      programName: parsed.programName,
      variantLabel: parsed.variantLabel,
      status,
      term: opts.term,
      sourceFilename: opts.sourceFilename,
      accentColor: identity.accentColor ?? null,
      tagline: identity.tagline ?? null,
      subtitle: identity.subtitle ?? null,
      imagePath: identity.imagePath ?? null,
      rules: (opts.rules ?? undefined) as Prisma.InputJsonValue | undefined,
    },
    update: {
      programCode: parsed.programCode,
      programName: parsed.programName,
      variantLabel: parsed.variantLabel,
      status,
      term: opts.term,
      sourceFilename: opts.sourceFilename,
      ...(identity.accentColor !== undefined ? { accentColor: identity.accentColor } : {}),
      ...(identity.tagline !== undefined ? { tagline: identity.tagline } : {}),
      ...(identity.subtitle !== undefined ? { subtitle: identity.subtitle } : {}),
      ...(identity.imagePath !== undefined ? { imagePath: identity.imagePath } : {}),
      ...(opts.rules !== undefined
        ? { rules: opts.rules as Prisma.InputJsonValue }
        : {}),
    },
  });

  // 2. upsert global Course rows for every real (non-placeholder) code
  const realCourses = parsed.courses.filter((c) => !c.isPlaceholder && c.normalizedCode);
  const courseIdByCode = new Map<string, number>();
  for (const c of realCourses) {
    const pr = prereqMap.get(c.normalizedCode);
    const row = await prisma.course.upsert({
      where: { normalizedCode: c.normalizedCode },
      create: {
        normalizedCode: c.normalizedCode,
        nameEs: pr?.nameEs || c.name,
        defaultCredits: pr?.credits ?? c.credits,
      },
      update: {
        nameEs: pr?.nameEs || c.name,
        defaultCredits: pr?.credits ?? c.credits,
      },
    });
    courseIdByCode.set(c.normalizedCode, row.id);
  }

  // 3. replace the catalog's CatalogCourse rows
  await prisma.catalogCourse.deleteMany({ where: { catalogId: catalog.id } });

  const makeCatalogCourseData = (c: ParsedCourse): Prisma.CatalogCourseCreateManyInput => {
    const pr = c.isPlaceholder ? undefined : prereqMap.get(c.normalizedCode);
    const prereqText = pr?.prereqText ?? "";
    const coreqText = pr?.coreqText ?? "";
    // Coreq codes in the export are often hyphenated lab/practice companions
    // ("IELE-1118L", "FISI-1518P"); a space lets the requirement tokenizer read
    // them as "<PREFIX> <number><letter>".
    const coreqExpr = coreqText.replace(/-/g, " ");
    return {
      catalogId: catalog.id,
      courseId: c.isPlaceholder ? null : (courseIdByCode.get(c.normalizedCode) ?? null),
      displayCode: c.displayCode,
      name: c.name,
      credits: c.credits,
      suggestedSemester: c.semester,
      courseType: c.courseType,
      isPlaceholder: c.isPlaceholder,
      placeholderKind: c.placeholderKind ?? null,
      placeholderLabel: c.placeholderLabel ?? null,
      sortIndex: c.sortIndex,
      prereqText: prereqText || null,
      coreqText: coreqText || null,
      prereqTree: toInputJson(parseRequirement(prereqText)),
      coreqTree: toInputJson(parseRequirement(coreqExpr)),
      pairingStatus: c.isPlaceholder ? "needs_manual" : "needs_manual",
    };
  };

  await prisma.catalogCourse.createMany({
    data: parsed.courses.map(makeCatalogCourseData),
  });

  const catalogCourses = await prisma.catalogCourse.findMany({
    where: { catalogId: catalog.id },
    orderBy: { sortIndex: "asc" },
  });
  const ccBySortIndex = new Map(catalogCourses.map((cc) => [cc.sortIndex, cc]));

  const counts = {
    auto_paired: 0,
    not_offered: 0,
    needs_manual: 0,
    placeholder_pool: 0,
    sync_failed: 0,
    manual_resolved: 0,
  };
  let apiFailureRate = 0;

  // 4. pairing
  if (opts.pair !== false) {
    const pairInput: PairInputCourse[] = parsed.courses.map((c) => ({
      sortIndex: c.sortIndex,
      normalizedCode: c.normalizedCode,
      displayCode: c.displayCode,
      name: c.name,
      credits: c.credits,
      semester: c.semester,
      isPlaceholder: c.isPlaceholder,
      placeholderKind: c.placeholderKind,
      placeholderLabel: c.placeholderLabel,
      prereqText: (c.isPlaceholder ? undefined : prereqMap.get(c.normalizedCode)?.prereqText) ?? null,
    }));

    const result = await pairCatalog(pairInput, opts.term, {
      concurrency: opts.concurrency,
      programCode: parsed.programCode,
      cache: opts.cache,
    });
    apiFailureRate = result.apiFailureRate;

    for (const r of result.courses) {
      const cc = ccBySortIndex.get(r.sortIndex);
      if (!cc) continue;
      await applyPairResult(r, cc, opts.term, courseIdByCode);
      counts[r.pairingStatus] = (counts[r.pairingStatus] ?? 0) + 1;
    }
  }

  return {
    slug: parsed.slug,
    catalogId: catalog.id,
    courseCount: parsed.courses.length,
    pairing: counts,
    apiFailureRate,
  };
}

async function applyPairResult(
  r: CoursePairResult,
  cc: { id: number; courseId: number | null; displayCode: string; name: string; credits: number; suggestedSemester: number; prereqText: string | null },
  term: string,
  courseIdByCode: Map<string, number>
) {
  await prisma.catalogCourse.update({
    where: { id: cc.id },
    data: { pairingStatus: r.pairingStatus },
  });

  // write CourseOffering for real courses we have a courseId for
  const courseId = cc.courseId ?? courseIdByCode.get(r.normalizedCode) ?? null;
  if (r.offering && courseId != null) {
    const o = r.offering;
    await prisma.courseOffering.upsert({
      where: { courseId_term: { courseId, term } },
      create: {
        courseId,
        term,
        offered: o.offered,
        canonicalTitle: o.canonicalTitle,
        canonicalCredits: o.canonicalCredits,
        sectionCount: o.sectionCount,
        seatsAvailableMin: o.seatsAvailableMin,
        seatsAvailableMax: o.seatsAvailableMax,
        attrs: o.attrs as unknown as Prisma.InputJsonValue,
        ptrmSet: o.ptrmSet as unknown as Prisma.InputJsonValue,
        syncError: o.syncError,
      },
      update: {
        offered: o.offered,
        canonicalTitle: o.canonicalTitle,
        canonicalCredits: o.canonicalCredits,
        sectionCount: o.sectionCount,
        seatsAvailableMin: o.seatsAvailableMin,
        seatsAvailableMax: o.seatsAvailableMax,
        attrs: o.attrs as unknown as Prisma.InputJsonValue,
        ptrmSet: o.ptrmSet as unknown as Prisma.InputJsonValue,
        syncError: o.syncError,
        lastSyncedAt: new Date(),
      },
    });
  }

  // create a ManualPairing prefill for anything not cleanly auto-paired
  const needsManualRow =
    r.pairingStatus === "needs_manual" ||
    r.pairingStatus === "not_offered" ||
    r.pairingStatus === "placeholder_pool" ||
    r.pairingStatus === "sync_failed";

  if (needsManualRow) {
    await prisma.manualPairing.upsert({
      where: { catalogCourseId: cc.id },
      create: {
        catalogCourseId: cc.id,
        excelCode: cc.displayCode,
        excelName: cc.name,
        excelCredits: cc.credits,
        excelSemester: cc.suggestedSemester,
        excelPrereqText: cc.prereqText,
        suggestedCode: r.manual?.suggestedCode ?? null,
        candidateCodes: (r.manual?.candidateCodes ?? null) as unknown as Prisma.InputJsonValue,
      },
      update: {
        excelCode: cc.displayCode,
        excelName: cc.name,
        excelCredits: cc.credits,
        excelSemester: cc.suggestedSemester,
        excelPrereqText: cc.prereqText,
        suggestedCode: r.manual?.suggestedCode ?? null,
        candidateCodes: (r.manual?.candidateCodes ?? null) as unknown as Prisma.InputJsonValue,
      },
    });
  } else {
    // auto_paired / manual_resolved: drop any stale manual row
    await prisma.manualPairing.deleteMany({ where: { catalogCourseId: cc.id } });
  }
}
