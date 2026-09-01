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
