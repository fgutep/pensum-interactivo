// Copied from Mi-Horario-Uniandes/src/types/ofertaDeCursosAPI.ts.
// Response shapes for https://ofertadecursos.uniandes.edu.co/api/courses .
// NOTE: in real responses every field arrives as a STRING (including nrc,
// credits, maxenrol, enrolled, time_ini, time_fin) despite these types — the
// endpoint is loosely typed. Coerce on read.

export interface HorarioAPI {
  classroom: string;
  time_ini: number;
  time_fin: number;
  date_ini: string;
  date_fin: string;
  l: string | null;
  m: string | null;
  i: string | null;
  j: string | null;
  v: string | null;
  s: string | null;
  d: string | null;
}

export interface ProfesorAPI {
  name: string;
}

export interface SeccionAPI {
  nrc: number;
  section: string;
  title: string;
  maxenrol: number;
  enrolled: number;
  campus: string;
  schedules: HorarioAPI[];
  instructors: ProfesorAPI[];
  class: string;
  course: string;
  credits: number;
  attr: { [code: string]: string }[];
  ptrm: string;
  term: string;
}

// ---- /api/courseDetails?term=&ptrm=&nrc= — per-section prereq/coreq/restrictions.
// The `courses` endpoint carries none of this; `courseDetails` (keyed by NRC) does.
// Every field arrives as a string, and the arrays are frequently empty.

/** A prerequisite expression. `code` is the Spanish boolean grammar our
 * requirementParser already handles; `descr` mirrors it with course names. */
export interface PrereqDetailAPI {
  code: string;
  descr?: string;
}

/** A corequisite — a course that must be taken the same term (or earlier). */
export interface CoreqDetailAPI {
  subject: string; // "IELE"
  coursenumber: string; // "2002L"
  title: string; // "LAB. TEORÍA ELECTROMAGNÉTICA"
}

/** An enrollment restriction (level / program / classification). Informational
 * only — never blocks a course in this app. */
export interface RestrictionDetailAPI {
  type: string; // "NIVEL"
  ind: string; // "INCLUYE(SOLO)" | "EXCLUYE" | ...
  desc: string[]; // ["PREGRADO"]
}

export interface CourseDetailsAPI {
  nrc: string;
  term: string;
  ptrm: string;
  class: string;
  course: string;
  compl: unknown[];
  master: unknown[];
  restr: RestrictionDetailAPI[];
  coreq: CoreqDetailAPI[];
  prereq: PrereqDetailAPI[];
  programsmaxenrol: unknown[];
}
