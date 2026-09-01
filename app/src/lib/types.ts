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

export interface PensumData {
  generatedAt: string;
  program: { code: string; name: string; catalogLabel: string };
  courses: Course[];
}

export type AvailabilityStatus =
  | "approved"
  | "available"
  | "one-away"
  | "blocked";
