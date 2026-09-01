// Generalizes app/scripts/build-data.mjs `isPlaceholderCode` + `inferType`.
// A "placeholder" is a slot in the pensum that is not a single real course
// (elective choice, CBU, libre-elección, a course whose code is a wildcard).

import type { CourseType } from "../types";
import { normalizeCode } from "./normalizeCode";

export type PlaceholderKind =
  | "CBU" // Ciclo Básico Uniandino slot
  | "ELECTIVA" // any elective slot ("ELECTIVA IELE", "ELECTIVA EN FUND. ING.")
  | "EFI" // electiva en fundamentos de ingeniería
  | "CLE" // curso de libre elección
  | "DEPT" // bare department token, e.g. "MATE", "ESCR"
  | "CODEX" // wildcard course code, e.g. "IELE 301X", "IELE xxxx", "IELE 1X18"
  | "CI"; // curso integrador

export interface Classification {
  isPlaceholder: boolean;
  placeholderKind?: PlaceholderKind;
  /** human name for the slot, shown in the graph and the manual-pairing queue */
  placeholderLabel?: string;
  courseType: CourseType;
}

function ph(
  kind: PlaceholderKind,
  courseType: CourseType,
  label: string
): Classification {
  return { isPlaceholder: true, placeholderKind: kind, placeholderLabel: label, courseType };
}

export function classifyCourse(displayCode: string, name: string): Classification {
  const rawUpper = (displayCode || "").toUpperCase().trim();
  const spaced = rawUpper.replace(/[^A-Z0-9ÑÁÉÍÓÚ ]/g, " ").replace(/\s+/g, " ").trim();
  const compact = normalizeCode(displayCode);
  const n = (name || "").toUpperCase();

  if (compact === "CBU") return ph("CBU", "cbu", name);
  if (compact === "CLE") return ph("CLE", "complementaria", name);
  if (compact === "EFI") return ph("EFI", "electiva", name);
  if (compact.includes("ELECTIVA") || n.includes("ELECTIVA"))
    return ph("ELECTIVA", "electiva", name);
  if (spaced === "IELE CI" || compact === "IELECI") return ph("CI", "nucleo", name);

  // wildcard code: "IELE301X", "IELEXXXX", "IELE1X18", "IELE1X08"
  if (/X{2,}/.test(compact) || /[0-9]X/.test(compact) || /X[0-9]/.test(compact)) {
    return ph("CODEX", n.includes("PROYECTO") ? "proyecto" : "nucleo", name);
  }

  // bare department token with no course number: "MATE", "ESCR", "DERE"...
  if (/^[A-ZÑ]{2,6}$/.test(compact)) return ph("DEPT", "nucleo", name);

  // a real course
  const courseType: CourseType = n.includes("PROYECTO") ? "proyecto" : "nucleo";
  return { isPlaceholder: false, courseType };
}
