import type { AvailabilityStatus, Course, ReqNode } from "./types";

// Appendix A of the product doc, adapted to the AND/OR/COURSE tree shape
// produced by the build-time requirement parser.

// Requirements that reference a code outside this catalog (a language exam,
// a placement equivalency, another department's course we don't have data
// for) can never be marked approved through this app. An AND branch made
// entirely of such codes is treated as vacuously satisfied (informational
// only, shown as text, never blocking). An OR branch is treated the same
// way ONLY when every alternative is external - if at least one in-catalog
// alternative exists, an external alternative must not let the OR
// "shortcut" to satisfied, or every course with an out-of-catalog variant
// would show as trivially available.
function hasCatalogLeaf(node: ReqNode, catalogCodes: Set<string>): boolean {
  if (node.op === "COURSE") return catalogCodes.has(node.code!);
  return (node.items ?? []).some((it) => hasCatalogLeaf(it, catalogCodes));
}

export function satisfied(
  node: ReqNode | null,
  approved: Set<string>,
  catalogCodes: Set<string>
): boolean {
  if (!node) return true;
  if (node.op === "COURSE") {
    if (!catalogCodes.has(node.code!)) return true; // out-of-catalog: informational only
    return approved.has(node.code!);
  }
  const items = node.items ?? [];
  if (node.op === "AND") return items.every((it) => satisfied(it, approved, catalogCodes));
  // OR: ignore alternatives with no in-catalog leaf at all, unless none of
  // them have one (fully external OR, vacuously satisfied).
  const relevant = items.filter((it) => hasCatalogLeaf(it, catalogCodes));
  if (relevant.length === 0) return true;
  return relevant.some((it) => satisfied(it, approved, catalogCodes));
}

/** Minimal (best-effort) set of in-catalog course codes that would need to
 * be approved to satisfy this node. For OR nodes, picks the branch with the
 * fewest missing courses rather than solving globally-optimal set cover. */
export function missingCodes(
  node: ReqNode | null,
  approved: Set<string>,
  catalogCodes: Set<string>
): Set<string> {
  if (!node) return new Set();
  if (node.op === "COURSE") {
    if (!catalogCodes.has(node.code!)) return new Set();
    return approved.has(node.code!) ? new Set() : new Set([node.code!]);
  }
  const items = node.items ?? [];
  if (node.op === "AND") {
    const out = new Set<string>();
    for (const item of items) {
      if (satisfied(item, approved, catalogCodes)) continue;
      for (const c of missingCodes(item, approved, catalogCodes)) out.add(c);
    }
    return out;
  }
  // OR
  const relevant = items.filter((it) => hasCatalogLeaf(it, catalogCodes));
  if (relevant.length === 0) return new Set();
  if (relevant.some((it) => satisfied(it, approved, catalogCodes))) return new Set();
  let best: Set<string> | null = null;
  for (const item of relevant) {
    const m = missingCodes(item, approved, catalogCodes);
    if (!best || m.size < best.size) best = m;
  }
  return best ?? new Set();
}

export interface CourseAvailability {
  status: AvailabilityStatus;
  missing: string[]; // course codes still needed (in-catalog or external)
}

export function catalogCodesOf(courses: Course[]): Set<string> {
  return new Set(courses.map((c) => c.codeNormalized));
}

export function courseAvailability(
  course: Course,
  approved: Set<string>,
  catalogCodes: Set<string>
): CourseAvailability {
  if (approved.has(course.id)) return { status: "approved", missing: [] };
  if (satisfied(course.prereqTree, approved, catalogCodes)) {
    return { status: "available", missing: [] };
  }
  const missing = [...missingCodes(course.prereqTree, approved, catalogCodes)];
  return {
    status: missing.length <= 1 ? "one-away" : "blocked",
    missing,
  };
}

export function creditsSummary(courses: Course[], approved: Set<string>) {
  const total = courses.reduce((sum, c) => sum + c.credits, 0);
  const done = courses
    .filter((c) => approved.has(c.id))
    .reduce((sum, c) => sum + c.credits, 0);
  return { done, total };
}

/** Longest remaining prerequisite chain among not-yet-approved courses,
 * counted in number of courses (a rough "min semesters left" proxy). */
export function criticalPathLength(
  courses: Course[],
  approved: Set<string>
): number {
  const byId = new Map(courses.map((c) => [c.id, c]));
  const memo = new Map<string, number>();
  const visiting = new Set<string>();

  function longest(id: string): number {
    if (approved.has(id)) return 0;
    if (memo.has(id)) return memo.get(id)!;
    if (visiting.has(id)) return 0; // guard against accidental cycles
    visiting.add(id);
    const course = byId.get(id);
    const deps = course?.prereqCourseIds ?? [];
    let best = 0;
    for (const dep of deps) {
      if (!byId.has(dep)) continue;
      best = Math.max(best, longest(dep));
    }
    const result = 1 + best;
    visiting.delete(id);
    memo.set(id, result);
    return result;
  }

  let max = 0;
  for (const c of courses) {
    if (c.isPlaceholder) continue;
    max = Math.max(max, longest(c.id));
  }
  return max;
}

/** All courses whose prerequisite/corequisite chain includes `id`
 * (transitive downstream impact set). */
export function downstreamOf(courses: Course[], id: string): Set<string> {
  const dependents = new Map<string, string[]>();
  for (const c of courses) {
    for (const dep of c.prereqCourseIds) {
      if (!dependents.has(dep)) dependents.set(dep, []);
      dependents.get(dep)!.push(c.id);
    }
  }
  const out = new Set<string>();
  const stack = [id];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const next of dependents.get(cur) ?? []) {
      if (!out.has(next)) {
        out.add(next);
        stack.push(next);
      }
    }
  }
  return out;
}

/** All transitive prerequisites of `id` (upstream chain, all hops). */
export function upstreamOf(courses: Course[], id: string): Set<string> {
  const byId = new Map(courses.map((c) => [c.id, c]));
  const out = new Set<string>();
  const stack = [id];
  while (stack.length) {
    const cur = stack.pop()!;
    const course = byId.get(cur);
    for (const dep of course?.prereqCourseIds ?? []) {
      if (!out.has(dep)) {
        out.add(dep);
        stack.push(dep);
      }
    }
  }
  return out;
}
