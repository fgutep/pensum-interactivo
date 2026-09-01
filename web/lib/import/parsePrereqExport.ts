// Parses "PRERREQUISITOS TODOS <term>.xlsx" (sheet "Export"), the university-wide
// requirements dump. One row per course, ~2900 rows. We index every row by
// normalized code so it can both (a) fill prereq/coreq text on catalog courses
// and (b) enrich the global Course registry with canonical names/credits.

import * as XLSX from "xlsx";
import { normalizeCode } from "./normalizeCode";

export interface PrereqRow {
  normalizedCode: string;
  nameEs: string;
  credits: number | null;
  prereqText: string;
  coreqText: string;
  restrictions: {
    periodo?: string;
    programa?: string;
    nivel?: string;
    grado?: string;
    departamento?: string;
    facultad?: string;
    campo?: string;
    atributosAlumno?: string;
  };
}

const COL = {
  materia: "Materia",
  creditos: "Créditos",
  nombre: "Nombre curso",
  pre: "Código prerrequisito",
  co: "Código correquisito",
  rPeriodo: "Restricción de periodo",
  rPrograma: "Restricción de programa",
  rNivel: "Restricción de nivel",
  rGrado: "Restricción de grado",
  rDepartamento: "Restricción de departamento",
  rFacultad: "Restricción de facultad",
  rCampo: "Restricción de campo de estudios",
  rAtributos: "Restricción de atributos alumno",
} as const;

function clean(v: unknown): string {
  const s = String(v ?? "").trim();
  return s === "-" ? "" : s;
}

export function parsePrereqExport(
  buffer: Buffer | ArrayBuffer
): Map<string, PrereqRow> {
  const wb = XLSX.read(buffer, {
    type: buffer instanceof Buffer ? "buffer" : "array",
  });
  const ws = wb.Sheets["Export"] ?? wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    raw: false,
    defval: "",
  });
  if (rows.length < 2) return new Map();

  const header = (rows[0] as unknown[]).map((h) => String(h ?? "").trim());
  const idx = (name: string) => header.indexOf(name);
  const iMateria = idx(COL.materia);
  if (iMateria < 0) return new Map();
  const iCred = idx(COL.creditos);
  const iNombre = idx(COL.nombre);
  const iPre = idx(COL.pre);
  const iCo = idx(COL.co);
  const iRPer = idx(COL.rPeriodo);
  const iRProg = idx(COL.rPrograma);
  const iRNiv = idx(COL.rNivel);
  const iRGra = idx(COL.rGrado);
  const iRDep = idx(COL.rDepartamento);
  const iRFac = idx(COL.rFacultad);
  const iRCam = idx(COL.rCampo);
  const iRAtr = idx(COL.rAtributos);

  const map = new Map<string, PrereqRow>();
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    const code = normalizeCode(row[iMateria]);
    if (!code) continue;
    const creditsRaw = iCred >= 0 ? Number.parseFloat(String(row[iCred] ?? "").replace(",", ".")) : NaN;
    // last row wins if a code somehow repeats; that's fine for our use
    map.set(code, {
      normalizedCode: code,
      nameEs: iNombre >= 0 ? clean(row[iNombre]) : "",
      credits: Number.isFinite(creditsRaw) ? creditsRaw : null,
      prereqText: iPre >= 0 ? clean(row[iPre]) : "",
      coreqText: iCo >= 0 ? clean(row[iCo]) : "",
      restrictions: {
        periodo: iRPer >= 0 ? clean(row[iRPer]) || undefined : undefined,
        programa: iRProg >= 0 ? clean(row[iRProg]) || undefined : undefined,
        nivel: iRNiv >= 0 ? clean(row[iRNiv]) || undefined : undefined,
        grado: iRGra >= 0 ? clean(row[iRGra]) || undefined : undefined,
        departamento: iRDep >= 0 ? clean(row[iRDep]) || undefined : undefined,
        facultad: iRFac >= 0 ? clean(row[iRFac]) || undefined : undefined,
        campo: iRCam >= 0 ? clean(row[iRCam]) || undefined : undefined,
        atributosAlumno: iRAtr >= 0 ? clean(row[iRAtr]) || undefined : undefined,
      },
    });
  }
  return map;
}
