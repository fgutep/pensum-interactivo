import type { Course, ReqNode } from "./types";

function codeLabel(code: string, byNormalized: Map<string, Course>): string {
  const course = byNormalized.get(code);
  return course ? `${course.code} (${course.name})` : code;
}

function render(
  node: ReqNode,
  byNormalized: Map<string, Course>,
  parentOp: "AND" | "OR" | null
): string {
  if (node.op === "COURSE") {
    const label = codeLabel(node.code!, byNormalized);
    return node.soft ? `${label}*` : label;
  }
  const joiner = node.op === "AND" ? " y " : " o ";
  const inner = (node.items ?? [])
    .map((it) => render(it, byNormalized, node.op as "AND" | "OR"))
    .join(joiner);
  const needsParens = parentOp !== null && parentOp !== node.op;
  return needsParens ? `(${inner})` : inner;
}

/** Human-readable Spanish rendering of a parsed requirement tree. */
export function renderRequirement(
  tree: ReqNode | null,
  allCourses: Course[]
): string {
  if (!tree) return "Sin prerrequisitos.";
  const byNormalized = new Map(allCourses.map((c) => [c.codeNormalized, c]));
  return render(tree, byNormalized, null);
}
