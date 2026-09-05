// Ported from app/src/lib/types.ts, extended with the offering/catalog-payload
// shapes the Next.js version adds. The Course / ReqNode shapes are unchanged so
// availability.ts and the React Flow graph keep working as-is.

export type CourseType =
  | "nucleo"
  | "electiva"
  | "cbu"
  | "complementaria"
  | "proyecto";

export interface ReqNode {
  op: "AND" | "OR" | "COURSE";
  items?: ReqNode[];
  code?: string;
  soft?: boolean;
}

export interface Course {
  id: string;
  code: string;
  codeNormalized: string;
  name: string;
  credits: number;
  semester: number;
  type: CourseType;
  isPlaceholder: boolean;
  /** placeholder taxonomy from the import (CBU|ELECTIVA|EFI|CLE|DEPT|CODEX|CI) */
  placeholderKind?: string | null;
  placeholderLabel?: string | null;
  prereqText: string;
  coreqText: string;
  prereqTree: ReqNode | null;
  prereqCourseIds: string[];
  prereqExternal: string[];
  /** parsed corequisite tree — courses that may be taken the same term (or earlier) */
  coreqTree: ReqNode | null;
  coreqCourseIds: string[];
  /** coreq codes not in this catalog (labs/practices like "IELE 1118L") */
  coreqExternal: string[];
}

export type AvailabilityStatus =
  | "approved"
  | "available"
  | "one-away"
  | "blocked";

// ---------- new: live-offering + catalog payload ----------

/** Per-course summary of this term's offering, derived from the Uniandes API. */
export interface OfferingBadge {
  offered: boolean;
  sectionCount: number;
  /** [min, max] free seats across sections, when known. */
  seatsAvailable?: [min: number, max: number];
  attrs: string[]; // e.g. ["EPSI", "VIRT"]
  ptrm: string[]; // e.g. ["8A", "16"]
  /** true when the last sync attempt failed and this data may be stale/absent. */
  syncFailed?: boolean;
}

/** One elective course from the "BOLSA DE ELECTIVAS" spreadsheets. */
export interface RoleCell {
  norm: string | null;
  raw: string;
}
export interface ElectiveDTO {
  id: number;
  name: string;
  code: string | null;
  level: "pregrado" | "maestria" | "other";
  ciclo: string | null;
  roles: {
    eleFrom2024: RoleCell;
    elcFrom2024: RoleCell;
    eleUntil2023: RoleCell;
    elcUntil2023: RoleCell;
  };
  offeredTerms: string[];
}

// ---------- admin progression rules ----------

/** A self-attested, non-course requirement (language, military service, …). */
export interface Attestation {
  id: string;
  label: string;
  description?: string;
  /** courses whose prereq tree references a code matching this regex are locked
   * until the student checks this attestation (covers "language requirement") */
  autoGatePrereqRegex?: string;
}

/** All sub-conditions present must hold (AND). */
export interface GateCondition {
  /** every catalog course whose codeNormalized matches this regex must be approved */
  allApprovedMatching?: string;
  /** every non-placeholder course with suggestedSemester <= N must be approved */
  maxApprovedSemester?: number;
  /** total approved credits must be >= N */
  minCredits?: number;
  /** the given attestation must be checked */
  attestationId?: string;
}

/** "You can't take course X until <condition>." */
export interface GateRule {
  id: string;
  label: string; // shown on the locked course + in the side panel
  /** which courses this rule locks */
  appliesTo: { codeRegex?: string; semesters?: number[]; ids?: string[] };
  condition: GateCondition;
}

export interface CatalogRules {
  gates: GateRule[];
  attestations: Attestation[];
}

/** A real elective a student has dropped into an elective slot (Mi avance mode). */
export interface ElectiveAssignment {
  /** live course code, e.g. "IELE4901" — null when it couldn't be resolved */
  code: string | null;
  title: string;
  credits: number | null;
  sectionCount?: number;
  /** id of the ElectiveDTO chosen from the bag (for re-highlighting the row) */
  electiveId?: number;
}

/** The denormalized document the student panel consumes for one catalog. */
export interface CatalogPayload {
  generatedAt: string;
  catalog: {
    slug: string;
    programCode: string;
    programName: string;
    variantLabel: string;
    term: string;
    status: string;
    accentColor?: string | null;
    tagline?: string | null;
    subtitle?: string | null;
    imagePath?: string | null;
  };
  /** Kept for PensumExplorer header back-compat with the old PensumData shape. */
  program: { code: string; name: string; catalogLabel: string };
  courses: Course[];
  /** keyed by Course.codeNormalized */
  offerings: Record<string, OfferingBadge>;
  /** sibling variants of the same/other program, for the picker menu */
  siblings: { slug: string; variantLabel: string; programName: string }[];
  /** full elective pool; the side-panel picker filters this client-side */
  electives: ElectiveDTO[];
  /** admin-defined progression rules (gates + attestations) */
  rules: CatalogRules;
}
