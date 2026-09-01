// Parses the two source spreadsheets in the repo root into a single JSON
// graph the React app consumes. This is a build-time step (not a runtime
// import pipeline) meant for the low-res prototype.
//
// Usage: node scripts/build-data.mjs
import XLSX from "xlsx";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");

const PENSUM_FILE = path.join(
  ROOT,
  "PENSUMS PREGRADO (DOCUMENTO BASE)) CBU3.xlsx"
);
const PREREQ_FILE = path.join(ROOT, "PRERREQUISITOS TODOS 202620.xlsx");
const PENSUM_SHEET = "PLAN PENSUM IELE CBU3";

const OUT_FILE = path.join(__dirname, "..", "src", "data", "pensum.generated.json");

function normalizeCode(raw) {
  return String(raw || "")
    .toUpperCase()
    .replace(/[^A-Z0-9ÑÁÉÍÓÚ]/g, "");
}

const SEMESTER_HEADER_RE =
  /^(PRIMER|SEGUNDO|TERCER|CUARTO|QUINTO|SEXTO|S[ÉE]PTIMO|OCTAVO)\s+SEMESTRE$/i;

function inferType(code, name) {
  const c = code.toUpperCase();
  const n = name.toUpperCase();
  if (c === "CBU") return "cbu";
  if (c.includes("ELECTIVA")) return "electiva";
  if (c === "CLE") return "complementaria";
  if (c === "EFI") return "electiva";
  if (n.includes("PROYECTO")) return "proyecto";
  return "nucleo";
}

function isPlaceholderCode(code) {
  const c = code.toUpperCase();
  return (
    c === "CBU" ||
    c.includes("ELECTIVA") ||
    c === "CLE" ||
    c === "EFI" ||
    /X{2,}/.test(c) ||
    /\dX\b/.test(c) ||
    c === "IELE CI"
  );
}

// ---------- 1. Parse the pensum grid sheet ----------
const pensumWb = XLSX.readFile(PENSUM_FILE);
const pensumWs = pensumWb.Sheets[PENSUM_SHEET];
if (!pensumWs) {
  throw new Error(`Sheet "${PENSUM_SHEET}" not found in ${PENSUM_FILE}`);
}
const pensumRows = XLSX.utils.sheet_to_json(pensumWs, {
  header: 1,
  raw: false,
  defval: "",
});

let currentSemester = 0;
const courses = []; // {id, code, name, credits, semester, type, isPlaceholder}
const placeholderCounts = {};

for (const row of pensumRows) {
  const col1 = String(row[1] || "").trim();
  const col2 = String(row[2] || "").trim();
  const col3 = String(row[3] || "").trim();

  if (!col1 && !col2) continue;

  if (SEMESTER_HEADER_RE.test(col1)) {
    currentSemester += 1;
    continue;
  }
  if (!col1) continue; // blank code cell (e.g. "Total Credit Hours" rows, spacer rows)
  if (col2.toUpperCase().startsWith("TOTAL CREDIT HOURS")) continue;
  if (col1.toUpperCase() === "TOTAL") continue;

  const credits = Number.parseFloat(col3.replace(",", "."));
  if (!Number.isFinite(credits)) continue; // not a course row

  const code = col1.trim();
  const name = col2.trim();
  const placeholder = isPlaceholderCode(code);
  const normalized = normalizeCode(code);

  let id;
  if (placeholder) {
    const key = `${normalized}-S${currentSemester}`;
    placeholderCounts[key] = (placeholderCounts[key] || 0) + 1;
    id = `${key}-${placeholderCounts[key]}`;
  } else {
    id = normalized;
  }

  courses.push({
    id,
    code,
    codeNormalized: normalized,
    name,
    credits,
    semester: currentSemester,
    type: inferType(code, name),
    isPlaceholder: placeholder,
  });
}

// ---------- 2. Parse the prerequisites export ----------
const prereqWb = XLSX.readFile(PREREQ_FILE);
const prereqWs = prereqWb.Sheets["Export"];
const prereqRows = XLSX.utils.sheet_to_json(prereqWs, {
  header: 1,
  raw: false,
  defval: "",
});
const header = prereqRows[0];
const idx = (name) => header.indexOf(name);
const iMateria = idx("Materia");
const iPre = idx("Código prerrequisito");
const iCo = idx("Código correquisito");

const courseCodeSet = new Set(courses.map((c) => c.codeNormalized));
const reqTextByCode = new Map(); // normalized code -> { prereq, coreq }

for (let i = 1; i < prereqRows.length; i++) {
  const row = prereqRows[i];
  const norm = normalizeCode(row[iMateria]);
  if (!courseCodeSet.has(norm)) continue;
  reqTextByCode.set(norm, {
    prereqText: String(row[iPre] || "").trim(),
    coreqText: String(row[iCo] || "").trim(),
  });
}

// ---------- 3. Tokenize + recursive-descent parse "A Y (B O C)" expressions ----------
function tokenize(expr) {
  const spaced = expr.replace(/\(/g, " ( ").replace(/\)/g, " ) ");
  const raw = spaced.split(/\s+/).filter(Boolean);

  const tokens = [];
  for (let i = 0; i < raw.length; i++) {
    const t = raw[i];
    if (t === "(" || t === ")") {
      tokens.push({ kind: "paren", value: t });
      continue;
    }
    if (t === "Y") {
      tokens.push({ kind: "and" });
      continue;
    }
    if (t === "O") {
      tokens.push({ kind: "or" });
      continue;
    }
    if (t === "-" || t === "*") continue; // stray separators
    // department letters, e.g. "MATE" followed by a number token "1207[*]"
    if (/^[A-ZÑ]{2,6}$/.test(t) && raw[i + 1] && /^\d{1,5}[A-Z]?\*?$/.test(raw[i + 1])) {
      const numTok = raw[i + 1];
      i++;
      const soft = numTok.endsWith("*");
      const code = t + numTok.replace(/\*$/, "");
      tokens.push({ kind: "code", value: code, soft });
      continue;
    }
    // already-fused code, e.g. "ENGL7", "EXMA1", "EXDO1"
    if (/^[A-ZÑ]+\d+[A-Z]?\*?$/.test(t)) {
      const soft = t.endsWith("*");
      tokens.push({ kind: "code", value: t.replace(/\*$/, ""), soft });
      continue;
    }
    // unrecognized token (rare) - ignore silently, expression stays best-effort
  }
  return tokens;
}

function parseExpr(tokens) {
  let pos = 0;
  const peek = () => tokens[pos];
  const consume = () => tokens[pos++];

  function parseOr() {
    let left = parseAnd();
    while (peek() && peek().kind === "or") {
      consume();
      const right = parseAnd();
      left = { op: "OR", items: [left, right] };
    }
    return left;
  }
  function parseAnd() {
    let left = parseAtom();
    while (peek() && peek().kind === "and") {
      consume();
      const right = parseAtom();
      left = { op: "AND", items: [left, right] };
    }
    return left;
  }
  function parseAtom() {
    const t = peek();
    if (!t) return null;
    if (t.kind === "paren" && t.value === "(") {
      consume();
      const node = parseOr();
      if (peek() && peek().kind === "paren" && peek().value === ")") consume();
      return node;
    }
    if (t.kind === "code") {
      consume();
      return { op: "COURSE", code: t.value, soft: !!t.soft };
    }
    // skip anything unexpected
    consume();
    return parseAtom();
  }

  if (tokens.length === 0) return null;
  return parseOr();
}

function collectCourseCodes(node, set = new Set()) {
  if (!node) return set;
  if (node.op === "COURSE") {
    set.add(node.code);
  } else {
    for (const item of node.items) collectCourseCodes(item, set);
  }
  return set;
}

// ---------- 4. Attach parsed requirements + graph edges to each course ----------
for (const course of courses) {
  const req = reqTextByCode.get(course.codeNormalized);
  course.prereqText = req?.prereqText || "";
  course.coreqText = req?.coreqText || "";

  const prereqTree = req?.prereqText ? parseExpr(tokenize(req.prereqText)) : null;
  course.prereqTree = prereqTree;

  const allCodes = prereqTree ? [...collectCourseCodes(prereqTree)] : [];
  // Only keep edges to codes that exist as real nodes in this catalog.
  course.prereqCourseIds = allCodes.filter((c) => courseCodeSet.has(c));
  course.prereqExternal = allCodes.filter((c) => !courseCodeSet.has(c));

  const coreqCode = req?.coreqText ? normalizeCode(req.coreqText) : "";
  course.coreqCourseIds =
    coreqCode && courseCodeSet.has(coreqCode) ? [coreqCode] : [];
}

// ---------- 5. Sanity output ----------
const withPrereqs = courses.filter((c) => c.prereqCourseIds.length > 0).length;
const withExternal = courses.filter((c) => c.prereqExternal.length > 0).length;
console.log(`Courses: ${courses.length}`);
console.log(`  with in-catalog prerequisite edges: ${withPrereqs}`);
console.log(`  with external (out-of-catalog) requirements: ${withExternal}`);

const payload = {
  generatedAt: new Date().toISOString(),
  program: {
    code: "IELE",
    name: "Ingeniería Eléctrica",
    catalogLabel: "CBU3 (documento base)",
  },
  courses,
};

writeFileSync(OUT_FILE, JSON.stringify(payload, null, 2), "utf-8");
console.log(`Wrote ${OUT_FILE}`);
