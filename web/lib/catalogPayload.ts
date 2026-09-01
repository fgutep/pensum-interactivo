// Builds the denormalized document the student panel consumes for one catalog.
// The `courses` array uses the exact `Course` shape from app/src/lib/types.ts so
// availability.ts and the React Flow graph work unchanged; edges are derived here
// from the stored prereq/coreq trees.

import { prisma } from "./db";
import type { CatalogPayload, Course, OfferingBadge, ReqNode } from "./types";
import { collectCourseCodes } from "./import/requirementParser";
import { normalizeCode } from "./import/normalizeCode";

function placeholderId(kind: string | null, semester: number, n: number): string {
  return `ph-${(kind ?? "slot").toLowerCase()}-s${semester}-${n}`;
}

export async function buildCatalogPayload(slug: string): Promise<CatalogPayload | null> {
  const catalog = await prisma.catalog.findUnique({
    where: { slug },
    include: {
      courses: {
        orderBy: { sortIndex: "asc" },
        include: {
          course: { include: { offerings: true } },
        },
      },
    },
  });
  if (!catalog) return null;

  // stable ids + the catalog's own code set (for edge filtering)
  const phCounters = new Map<string, number>();
  const rows = catalog.courses.map((cc) => {
    let id: string;
    let codeNormalized: string;
    if (cc.isPlaceholder) {
      const key = `${cc.placeholderKind}-${cc.suggestedSemester}`;
      const n = (phCounters.get(key) ?? 0) + 1;
      phCounters.set(key, n);
      id = placeholderId(cc.placeholderKind, cc.suggestedSemester, n);
      codeNormalized = normalizeCode(cc.displayCode) || id;
    } else {
      codeNormalized = cc.course?.normalizedCode ?? normalizeCode(cc.displayCode);
      id = codeNormalized;
    }
    return { cc, id, codeNormalized };
  });

  const catalogCodes = new Set(rows.map((r) => r.codeNormalized));
  const idByCode = new Map(rows.map((r) => [r.codeNormalized, r.id]));

  const courses: Course[] = rows.map(({ cc, id, codeNormalized }) => {
    const prereqTree = (cc.prereqTree as ReqNode | null) ?? null;
    const allPrereq = [...collectCourseCodes(prereqTree)];
    const prereqCourseIds = allPrereq
      .filter((c) => catalogCodes.has(c))
      .map((c) => idByCode.get(c)!)
      .filter(Boolean);
    const prereqExternal = allPrereq.filter((c) => !catalogCodes.has(c));

    const coreqNorm = cc.coreqText ? normalizeCode(cc.coreqText) : "";
    const coreqCourseIds =
      coreqNorm && catalogCodes.has(coreqNorm) && idByCode.get(coreqNorm)
        ? [idByCode.get(coreqNorm)!]
        : [];

    return {
      id,
      code: cc.displayCode,
      codeNormalized,
      name: cc.name,
      credits: cc.credits,
      semester: cc.suggestedSemester,
      type: cc.courseType as Course["type"],
      isPlaceholder: cc.isPlaceholder,
      prereqText: cc.prereqText ?? "",
      coreqText: cc.coreqText ?? "",
      prereqTree,
      prereqCourseIds,
      prereqExternal,
      coreqCourseIds,
    };
  });

  // offerings for this catalog's term, keyed by codeNormalized
  const offerings: Record<string, OfferingBadge> = {};
  for (const { cc, codeNormalized } of rows) {
    if (cc.isPlaceholder || !cc.course) continue;
    const off = cc.course.offerings.find((o) => o.term === catalog.term);
    if (!off) continue;
    const min = off.seatsAvailableMin;
    const max = off.seatsAvailableMax;
    offerings[codeNormalized] = {
      offered: off.offered,
      sectionCount: off.sectionCount,
      seatsAvailable: min != null && max != null ? [min, max] : undefined,
      attrs: (off.attrs as string[] | null) ?? [],
      ptrm: (off.ptrmSet as string[] | null) ?? [],
      syncFailed: cc.pairingStatus === "sync_failed" || !!off.syncError,
    };
  }

  const siblings = await prisma.catalog.findMany({
    where: { status: "published", NOT: { slug } },
    select: { slug: true, variantLabel: true, programName: true },
    orderBy: [{ programCode: "asc" }, { slug: "asc" }],
  });

  return {
    generatedAt: new Date().toISOString(),
    catalog: {
      slug: catalog.slug,
      programCode: catalog.programCode,
      programName: catalog.programName,
      variantLabel: catalog.variantLabel,
      term: catalog.term,
      status: catalog.status,
    },
    program: {
      code: catalog.programCode,
      name: catalog.programName,
      catalogLabel: [catalog.variantLabel, `CBU3 · ${catalog.term}`].filter(Boolean).join(" · "),
    },
    courses,
    offerings,
    siblings,
  };
}
