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
  prereqText: string;
  coreqText: string;
  prereqTree: ReqNode | null;
  prereqCourseIds: string[];
  prereqExternal: string[];
  coreqCourseIds: string[];
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
  };
  /** Kept for PensumExplorer header back-compat with the old PensumData shape. */
  program: { code: string; name: string; catalogLabel: string };
  courses: Course[];
  /** keyed by Course.codeNormalized */
  offerings: Record<string, OfferingBadge>;
  /** sibling variants of the same/other program, for the picker menu */
  siblings: { slug: string; variantLabel: string; programName: string }[];
}
