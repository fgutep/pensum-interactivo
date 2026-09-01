# Re-scope: Pensum app → Next.js full-stack with DB, admin panel, and live API pairing

## Context — why this change

The current `Custom_Pensum/app` is a Vite + React 19 SPA that renders **one hardcoded IELE pensum**
as a React Flow prerequisite graph. Its data is baked at build time by `app/scripts/build-data.mjs`
(parses two `.xlsx` files → `src/data/pensum.generated.json`). To change the curriculum you must
re-run the script and redeploy.

We have now verified the university's course API is publicly usable
(`https://ofertadecursos.uniandes.edu.co/api/courses`, CORS-open, no auth). Pairing a pensum course
to the live offering is a straightforward key match: `normalizeCode(pensumCode) === API.class + API.course`
(29/34 concrete IELE courses auto-match for term 202620; the misses simply aren't offered that term).

This unlocks a re-scope the team wants:

1. **Student panel** — pick one of several *recommended pensums*, track approved courses, see per-course
   status, see whether each course is offered this term, and deep-link to **Mi-Horario-Uniandes** for
   actual scheduling (we do **not** build a timetable here).
2. **`/administrador` panel** (no link from the student UI) — an academic coordinator uploads the
   Excel; the server parses all sheets, heuristically pairs courses/attributes against the API, and
   drops anything unresolved into a **manual-pairing queue** prefilled with whatever the Excel gives.
3. **A database** so uploads persist without a redeploy.
4. **One Docker container**, greenfield — no current deployment exists.

### Locked decisions (from the user)

| Area | Decision |
|---|---|
| Stack | **Next.js (App Router) full-stack, TypeScript.** One app: student UI + `/administrador` + API routes + server-side Excel parsing + server-side pairing. Drop the product doc's Python/FastAPI stack. |
| DB | **SQLite on a mounted Docker volume**, via **Prisma** (so a later Postgres swap is a `provider` change). `DATABASE_URL=file:/data/app.db`. |
| "See the classes" | **Link out to Mi-Horario only.** Student panel shows offering *badges* (offered? / #sections / seats / attrs / 8A-8B-16wk) from the pairing, plus a configurable deep link. No sections list, no calendar. |
| Deployment | Greenfield. Write the Dockerfile + app from scratch, working end-to-end (not production-hardened). |
| Admin auth (v1) | Single shared `ADMIN_PASSWORD` + `SESSION_SECRET`-signed httpOnly cookie, enforced by `middleware.ts`. Behind an `AuthProvider` interface so OIDC can replace it later. |
| Multi-variant | The Excel's 5 sheets → 5 selectable **catalogs**. Student picks one from a menu. `suggestedSemester` is a first-class per-catalog attribute of each course. |

### Source data facts

- `PENSUMS PREGRADO (DOCUMENTO BASE)) CBU3.xlsx` — **5 sheets** (exact names, stable):
  `PLAN PENSUM IELE CBU3`, `PLAN PENSUM IELE CBU3 PC`, `PLAN PENSUM IELC CBU3`,
  `PLAN PENSUM IELC CBU3 PC`, `PLAN PENSUM DOBLE  CBU3` (two spaces). Grid per sheet: a
  "Primer/Segundo/… Semestre" header row precedes each semester block; course rows have
  col1=code, col2=name, col3=credits, cols ≥8 = SEM1..SEMn (credit value sits in the course's
  semester column). "Total Credit Hours:" rows interleaved. DOBLE runs ~10–12 semesters and is wider.
- `PRERREQUISITOS TODOS 202620.xlsx` — 1 sheet `Export`, ~2900 rows, term 202620. Columns:
  `Materia`, `Créditos`, `Nombre curso`, `Código prerrequisito` (Spanish boolean expr, e.g.
  `"(IELE 1002 O IELE 1006) Y (MATE 2210* O MATE 2211*)"`), `Código correquisito`, plus restriction columns.
- Placeholders in the pensum sheets: `CBU`, `ELECTIVA IELE`, `CLE`, `EFI`, `IELE xxxx`, `IELE 301X`,
  `IELE CI`, bare dept codes (`MATE`, `ESCR`). These cannot 1:1 match the API.

---

## A. Repo / app layout

**New app at `Custom_Pensum/web/`. Keep the two `.xlsx` + `pensum-interactivo-product-doc.md` at repo
root. Leave `Custom_Pensum/app/` on disk (unbuilt, `.dockerignore`d) as migration reference until P1
closes, then delete it.** `Dockerfile` lives in `web/`; `docker-compose.yml` + `.dockerignore` at repo root.

### Asset migration map

| Current | New home | Change |
|---|---|---|
| `app/src/lib/availability.ts` | `web/lib/availability.ts` | **verbatim, unchanged** |
| `app/src/lib/requirementText.ts` | `web/lib/requirementText.ts` | **verbatim, unchanged** |
| `app/src/lib/types.ts` | `web/lib/types.ts` | ported + **extended** (`OfferingBadge`, `CatalogPayload`) |
| `app/src/lib/persistence.ts` | `web/lib/persistence.ts` | ported; **every fn takes `slug`**, `STORAGE_KEY` → `pensum:${slug}:approved` |
| `app/src/components/{CurriculumGraph,CourseNode,SidePanel,SummaryBar,SearchBar}.tsx` | `web/components/` | as-is + `"use client"`; **SidePanel** gains an offering block + Mi-Horario link |
| `app/src/App.tsx` (body) | `web/components/PensumExplorer.tsx` | `"use client"`; `data` becomes a prop; header reads catalog meta; + variant `<select>` + disclaimer banner |
| `app/src/App.css` + `app/src/index.css` | `web/app/globals.css` | concatenated; **poster CSS preserved verbatim** (`.course-node`, `type-*`, `status-*`, `is-placeholder`, `is-dimmed`) |
| `app/scripts/build-data.mjs` — `tokenize()`, `parseExpr()`, `collectCourseCodes()`, `normalizeCode()` | `web/lib/import/requirementParser.ts` + `web/lib/import/normalizeCode.ts` | **lifted verbatim**, single source of truth |
| `app/scripts/build-data.mjs` — grid state-machine | `web/lib/import/parsePensumWorkbook.ts` | generalized to all 5 sheets |
| `app/scripts/build-data.mjs` (the script) | **deleted**, replaced by `web/scripts/seed.ts` | |
| `app/src/data/pensum.generated.json` | **deleted** (data now in SQLite) | |
| `Mi-Horario-Uniandes/src/services/fetcher.ts` | `web/lib/shared-oferta/fetcher.ts` | **copied**, `@/` alias → relative imports |
| `Mi-Horario-Uniandes/src/types/ofertaDeCursosAPI.ts` | `web/lib/shared-oferta/ofertaDeCursosAPI.ts` | copied as-is |
| `Mi-Horario-Uniandes/src/models/{Curso,Seccion,Profesor,BloqueTiempo}.ts` | `web/lib/shared-oferta/models.ts` | copied; pairing uses `Curso` + `Seccion` only |

### App Router tree

```
web/
├── app/
│   ├── layout.tsx                       # <html lang="es"> shell
│   ├── globals.css                      # old App.css + index.css (poster styles)
│   ├── page.tsx                         # student landing = <CatalogPicker> (server component)
│   ├── (student)/p/[slug]/page.tsx      # server: buildCatalogPayload(slug) -> <PensumExplorer>
│   ├── administrador/
│   │   ├── layout.tsx  login/page.tsx
│   │   ├── page.tsx                     # catalog list + pairing summary
│   │   ├── import/page.tsx              # upload form (pensum xlsx + optional prereq xlsx)
│   │   ├── import/[jobId]/page.tsx      # validation report + diff + apply / discard
│   │   ├── pairing/[slug]/page.tsx      # manual-pairing queue
│   │   └── snapshots/[slug]/page.tsx    # snapshot list + rollback
│   └── api/
│       ├── health/route.ts
│       ├── catalogs/route.ts            # GET published catalogs
│       ├── catalogs/[slug]/route.ts     # GET denormalized payload (ETag, Cache-Control max-age=300)
│       └── admin/
│           ├── login/route.ts  logout/route.ts
│           ├── imports/route.ts                     # POST upload -> parse -> diff
│           ├── imports/[jobId]/route.ts             # GET job
│           ├── imports/[jobId]/apply/route.ts       # POST
│           ├── imports/[jobId]/discard/route.ts     # DELETE
│           ├── catalogs/[slug]/resync/route.ts      # POST re-sync offerings (term overridable)
│           ├── course-search/route.ts               # GET proxy to ofertadecursos (manual-queue widget)
│           ├── pairing/[id]/route.ts                # PATCH resolve a manual_pairing row
│           └── snapshots/[id]/restore/route.ts      # POST rollback
├── components/                          # PensumExplorer, CurriculumGraph, CourseNode, SidePanel,
│                                        # SummaryBar, SearchBar, CatalogPicker, admin/* tables
├── lib/
│   ├── types.ts availability.ts requirementText.ts persistence.ts   # ported pure modules
│   ├── db.ts                            # Prisma client singleton
│   ├── catalogPayload.ts               # DB rows -> CatalogPayload (derives edges from trees)
│   ├── auth/{AuthProvider.ts, passwordProvider.ts, session.ts}
│   ├── shared-oferta/{fetcher.ts, ofertaDeCursosAPI.ts, models.ts}
│   ├── import/{normalizeCode.ts, requirementParser.ts, parsePensumWorkbook.ts,
│   │           parsePrereqExport.ts, classifyPlaceholder.ts, diff.ts, apply.ts}
│   └── pairing/{pairCatalog.ts, placeholderHeuristics.ts, offeringsCache.ts}
├── prisma/{schema.prisma, migrations/}
├── scripts/seed.ts
├── middleware.ts                        # gate /administrador/* + /api/admin/* (except login)
├── next.config.mjs                      # output: 'standalone'
└── Dockerfile  package.json  tsconfig.json
```

---

## B. Data model (Prisma, SQLite)

**Requirement storage: JSON `prereqTree` / `coreqTree` columns on `CatalogCourse`** (the parsed
`ReqNode` shape). Rationale: `lib/availability.ts` already consumes exactly that shape and
`requirementParser.ts` already emits it; v1 has no in-app boolean editing — all requirement changes
arrive via Excel re-import and are re-parsed. Raw `prereqText`/`coreqText` are also kept for provenance
and manual correction. Normalized `requirement`/`requirement_item` tables are deferred until an in-app
requirement builder is actually scoped.

```prisma
datasource db { provider = "sqlite"; url = env("DATABASE_URL") }
generator client { provider = "prisma-client-js" }

model Catalog {
  id             Int      @id @default(autoincrement())
  slug           String   @unique          // iele-cbu3 | iele-cbu3-pc | ielc-cbu3 | ielc-cbu3-pc | doble-cbu3
  programCode    String                    // IELE | IELC | DOBLE
  programName    String                    // "Ingeniería Eléctrica"
  variantLabel   String                    // "" | "con Precálculo" | "Electrónica" | "Doble programa"
  status         String   @default("draft")// draft | published | archived
  term           String                    // term offerings were synced against, e.g. "202620"
  sourceFilename String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  courses        CatalogCourse[]
  snapshots      CatalogSnapshot[]
  importJobs     ImportJob[]
  @@index([status])
}

model Course {                              // global course registry
  id             Int      @id @default(autoincrement())
  normalizedCode String   @unique           // "IELE2100"
  nameEs         String
  nameEn         String?
  defaultCredits Float?
  createdAt      DateTime @default(now())
  catalogCourses CatalogCourse[]
  offerings      CourseOffering[]
}

model CatalogCourse {
  id                Int      @id @default(autoincrement())
  catalogId         Int
  courseId          Int?                    // null for an unbound placeholder
  displayCode       String                  // raw Excel col1: "IELE 2100" | "CBU" | "ELECTIVA IELE" | "IELE 301X"
  name              String
  credits           Float
  suggestedSemester Int
  courseType        String                  // nucleo|electiva|cbu|complementaria|proyecto
  isPlaceholder     Boolean  @default(false)
  placeholderKind   String?                 // CBU|ELECTIVA|EFI|CLE|DEPT|CODEX|CI
  placeholderLabel  String?
  sortIndex         Int                     // sheet row order within catalog (stable slot key)
  prereqText        String?
  coreqText         String?
  prereqTree        Json?                   // ReqNode | null  — consumed as-is by availability.ts
  coreqTree         Json?
  pairingStatus     String   @default("needs_manual")
        // auto_paired | not_offered | needs_manual | manual_resolved | placeholder_pool | sync_failed
  catalog           Catalog  @relation(fields: [catalogId], references: [id], onDelete: Cascade)
  course            Course?  @relation(fields: [courseId], references: [id])
  manualPairing     ManualPairing?
  @@unique([catalogId, sortIndex])
  @@index([catalogId]) @@index([pairingStatus])
}

model CourseOffering {                       // global per (course, term) — one fetch serves all 5 catalogs
  id                Int      @id @default(autoincrement())
  courseId          Int
  term              String
  offered           Boolean
  canonicalTitle    String?
  canonicalCredits  Float?
  sectionCount      Int      @default(0)
  seatsAvailableMin Int?
  seatsAvailableMax Int?
  attrs             Json?    // string[]  e.g. ["EPSI","VIRT"]
  ptrmSet           Json?    // string[]  e.g. ["8A","16"]
  lastSyncedAt      DateTime @default(now())
  syncError         String?
  course            Course   @relation(fields: [courseId], references: [id], onDelete: Cascade)
  @@unique([courseId, term]) @@index([term])
}

model ManualPairing {
  id                Int      @id @default(autoincrement())
  catalogCourseId   Int      @unique
  excelCode         String
  excelName         String
  excelCredits      Float?
  excelSemester     Int?
  excelPrereqText   String?
  suggestedCode     String?
  candidateCodes    Json?    // string[] (placeholder pools)
  resolvedCode      String?
  resolvedNote      String?
  keepAsPlaceholder Boolean  @default(false)
  resolvedBy        String?
  resolvedAt        DateTime?
  createdAt         DateTime @default(now())
  catalogCourse     CatalogCourse @relation(fields: [catalogCourseId], references: [id], onDelete: Cascade)
}

model ImportJob {
  id             Int      @id @default(autoincrement())
  filename       String
  prereqFilename String?
  uploadedBy     String
  status         String   @default("parsed")   // parsed | failed | applied | discarded
  scope          String                         // "all" | a slug
  diff           Json?
  errors         Json?
  warnings       Json?
  parsedPayload  Json?                          // ParsedCatalog[] retained until apply/discard
  uploadedAt     DateTime @default(now())
  appliedAt      DateTime?
  catalogId      Int?
  catalog        Catalog? @relation(fields: [catalogId], references: [id])
}

model CatalogSnapshot {
  id        Int      @id @default(autoincrement())
  catalogId Int
  payload   Json                                // full denormalized catalog
  reason    String                              // pre-import | pre-restore | manual
  createdBy String?
  createdAt DateTime @default(now())
  catalog   Catalog  @relation(fields: [catalogId], references: [id], onDelete: Cascade)
  @@index([catalogId])
}

model AuditLog {
  id Int @id @default(autoincrement())
  actor String
  action String
  entityType String
  entityId String
  before Json?
  after Json?
  createdAt DateTime @default(now())
}
```

SQLite runtime: WAL mode, `PRAGMA busy_timeout=5000`, Prisma `connection_limit=1`.

### Read payload — `GET /api/catalogs/:slug` and `buildCatalogPayload(slug)`

```ts
interface CatalogPayload {
  generatedAt: string;
  catalog: { slug; programCode; programName; variantLabel; term; status };
  program: { code; name; catalogLabel };            // kept for PensumExplorer header back-compat
  courses: Course[];                                 // EXISTING lib/types Course shape — unchanged
  offerings: Record<string /* normalizedCode */, OfferingBadge>;
  siblings: { slug; variantLabel }[];                // for the variant <select>
}
interface OfferingBadge {
  offered: boolean; sectionCount: number;
  seatsAvailable?: [min: number, max: number];
  attrs: string[]; ptrm: string[]; syncFailed?: boolean;
}
```

`catalogPayload.ts` reconstructs `Course.id` exactly like `build-data.mjs` did (real →
`normalizedCode`; placeholder → `${placeholderKind}-S${semester}-${n}`) and **derives**
`prereqCourseIds` / `prereqExternal` / `coreqCourseIds` by intersecting `collectCourseCodes(tree)` with
the catalog's code set — so `availability.ts` and `CurriculumGraph.tsx` need zero changes. Response
carries `ETag` (payload hash) + `Cache-Control: public, max-age=300`.

---

## C. Excel import subsystem (`web/lib/import/`)

**`parsePensumWorkbook(buffer): ParsedCatalog[]`** — `XLSX.read(buffer)`, iterate **all 5**
`wb.SheetNames`. Static lookup keyed by exact sheet name → `{slug, programCode, programName,
variantLabel}` (fallback: derive program from row 0 text). Per sheet, `sheet_to_json(ws,{header:1,
raw:false,defval:""})`, then a row-scanning state machine generalized from `build-data.mjs:68-114`:

- `col1/col2/col3 = row[1]/row[2]/row[3]` trimmed; both col1 & col2 empty → skip.
- `SEMESTER_HEADER_RE.test(col1)` → `currentSemester++` — **extend the regex** with
  `NOVENO|D[ÉE]CIMO|UND[ÉE]CIMO|DUOD[ÉE]CIMO|…` for the DOBLE sheet.
- `col2` starts `"TOTAL CREDIT HOURS"` or `col1 === "TOTAL"` → skip.
- `credits = parseFloat(col3.replace(",","."))`; not finite → not a course row, skip.
- **Semester cross-check:** scan *every* column index > 7 for a cell whose numeric value equals
  `credits`; the ordinal of that column (SEM1 = first such column across the sheet) is the
  column-derived semester. Disagreement with the header count → trust the column, push a warning.
  Do **not** hardcode columns 8–16 (DOBLE is wider).
- `classifyPlaceholder(displayCode, name)` → `{isPlaceholder, kind, label}`; push with `sortIndex++`.

**`classifyPlaceholder(code, name)`** (generalizes `isPlaceholderCode` + `inferType`):

| Uppercased-code test | kind | courseType |
|---|---|---|
| `=== "CBU"` | CBU | cbu |
| `includes("ELECTIVA")` | ELECTIVA | electiva |
| `=== "CLE"` | CLE | complementaria |
| `=== "EFI"` | EFI | electiva |
| `/X{2,}/` or `/\dX\b/` (`IELE 301X`, `IELE xxxx`) | CODEX | nucleo (label = name) |
| `=== "IELE CI"` | CI | nucleo |
| `/^[A-ZÑ]{2,6}$/`, no digits (`MATE`, `ESCR`) | DEPT | nucleo (label = name) |
| else (real course) | — | name includes `"PROYECTO"` → proyecto, else nucleo |

**`requirementParser.ts`** — lift `tokenize()`, `parseExpr()`, `collectCourseCodes()` **verbatim** from
`build-data.mjs:144-237`; `normalizeCode()` from `:23-27` into `normalizeCode.ts`. Grammar unchanged
(`O` looser than `Y`, parens, `MATE 1207*` → `{op:"COURSE",code:"MATE1207",soft:true}`, no NOT, no
credit-count). Callers: `parsePrereqExport.ts`, `apply.ts`, `seed.ts`.

**`parsePrereqExport(buffer): Map<normalizedCode, PrereqRow>`** — sheet `Export`; header row →
column indices by name. Emit for **every** row (~2900 — also feeds the global `Course` registry):
`{prereqText, coreqText, credits, nameEs, restrictions}`. Join: for each parsed course,
`map.get(normalizedCode)` → set text, then `prereqTree = parseExpr(tokenize(prereqText))`,
`coreqTree` likewise. `restrictions` stored informational-only (never blocking).

**Coordinator supply:** one upload form, two file inputs — pensum `.xlsx` (required) + prereq `.xlsx`
(optional). If prereq omitted on re-import, carry forward existing `prereqTree`/`coreqTree` from the
current DB rows by `normalizedCode`. `seed.ts` always uses both repo files.

**`diff(parsed, currentFromDb)`** → `{added[], removed[], modified[{code,field,before,after}],
unchanged, prereqChanges[], pairingPreview:{autoPaired,notOffered,needsManual}}`. Match real courses by
`normalizedCode`, placeholders by `(placeholderKind, semester, sortIndex)`. Stored in `import_job.diff`
+ full `parsedPayload`. **Nothing touches catalog tables at parse time.**

**`apply(jobId)`** — only on explicit admin confirm — one `prisma.$transaction`:
1. `CatalogSnapshot(reason:"pre-import")` per affected catalog (payload via `catalogPayload.ts`);
2. `upsert` global `Course` for every real `normalizedCode` (+ enrich `nameEs`/`defaultCredits`);
3. delete + recreate the catalog's `CatalogCourse` rows from `parsedPayload` (trivial at ~60 rows);
   re-attach surviving `ManualPairing` rows by `(catalogId, sortIndex)` / resolved code;
4. `import_job.status="applied"`, `appliedAt=now`;
5. after commit → run `pairCatalog` for the catalog's `term`.

---

## D. API pairing subsystem (`web/lib/pairing/`)

**`pairCatalog(catalogCourses, term, opts)`** — `opts`: `{concurrency = PAIRING_CONCURRENCY ?? 4,
timeoutMs = 8000, retries = 1}`. `offeringsCache.ts` holds a module-level
`Map<`${term}:${normalizedCode}`, Curso[]>` to dedupe fetches across the 5 catalogs in one run.

- **Non-placeholder course:** `crearCursosAPartirDePeticion(`${API}?term=${term}&nameInput=${code}`)`
  (reused from `shared-oferta/fetcher.ts`); keep `Curso` where `class + course === normalizedCode`.
  - found → aggregate `CourseOffering`: `offered:true`, `canonicalTitle`/`canonicalCredits` from first
    section, `sectionCount` = distinct `nrc`, `seatsAvailableMin/Max` from `maxenrol − enrolled`,
    `attrs` = union of `attr[].code`, `ptrmSet` = union of `8A`/`8B`/else `"16"`.
    `catalogCourse.pairingStatus = "auto_paired"`.
  - not found → `offered:false`, `pairingStatus="not_offered"`, create `ManualPairing` prefilled from Excel.
  - fetch failed after retries → `pairingStatus="sync_failed"`, **keep any prior `CourseOffering`**, never block.
- **Placeholders** (`placeholderHeuristics.ts`, by `placeholderKind`):
  - `CBU` → query `programasEspeciales` prefixes (`CBCC/CBUH/CBUT/DEPO`) → candidate list →
    `pairingStatus="placeholder_pool"`, `ManualPairing.candidateCodes`.
  - `ELECTIVA` / `EFI` / `CLE` → `needs_manual`; `suggestedCode` query from label prefix (`"ELECTIVA IELE"`
    → `prefix=IELE`) or attr `EPSI`.
  - `DEPT` (`MATE`) / `CODEX` (`IELE 301X`) with a real `placeholderLabel` (e.g. `"ECUACIONES
    DIFERENCIALES"`) → fetch that prefix for `term`, accent-fold + token-set-ratio match label vs API
    `title`; best above threshold → `suggestedCode`; `needs_manual`.
  - `CI` / unknown → `needs_manual`, `ManualPairing` prefilled.
- **Politeness / degradation:** `p-limit`-style concurrency ≤ 4 (sequential fallback); per-term cache;
  `AbortController` 8 s timeout; 1 retry @ 500 ms; if > 50 % of fetches fail in a run, abort the rest,
  mark them `sync_failed`, surface "API no disponible" in the admin summary. **Never rolls back an applied import.**
- **Runs:** (a) after `apply()` commits, for the catalog's `term`; (b) on demand via
  `POST /api/admin/catalogs/:slug/resync` (term overridable in the body).

---

## E. Student panel

- **`/` — `CatalogPicker`** (server component, reads DB): lists `status="published"` catalogs grouped
  by `programCode`; each `variantLabel` links to `/p/<slug>`.
- **`/p/[slug]/page.tsx`** (server component): `buildCatalogPayload(slug)` directly (no self-fetch) →
  `<PensumExplorer data={payload} />`. Same builder backs the public `GET /api/catalogs/:slug`.
- **`PensumExplorer.tsx`** = current `App.tsx` body, `"use client"`: `data` as prop; header from
  `catalog.programName` + `variantLabel`; a variant `<select>` (from `payload.siblings`) that
  `router.push`es to the sibling slug; **mandatory persistent disclaimer banner** (informational tool;
  official curriculum is the Registro Académico's; confirm with an advisor; outbound link).
- **Availability runs client-side, unchanged** — all of `lib/availability.ts` operates over
  `payload.courses` exactly as today.
- **`persistence.ts`** — `STORAGE_KEY` → `pensum:${slug}:approved`; every fn takes `slug`; URL hash
  stays `#aprobadas=CSV`; localStorage + share-URL both retained.
- **`SidePanel`** — new "Oferta <term>" block from `payload.offerings[course.codeNormalized]`: status
  line ("Se dicta" / "No se ofrece este semestre" / "Sin datos de oferta" on `syncFailed`),
  `sectionCount`, seats range, attribute chips, `8A`/`8B`/`16`-semanas chips; plus **"Ver secciones en
  Mi-Horario"** → `MIHORARIO_URL` (env; base URL, optionally `?nameInput=<code>` appended
  optimistically). Placeholders show no offering block.

---

## F. Admin panel (`/administrador`) — no link from the student UI

Auth behind `lib/auth/AuthProvider`: `passwordProvider` compares `ADMIN_PASSWORD`, issues a
`SESSION_SECRET`-signed httpOnly `SameSite=Lax; Secure` cookie; `session.ts` signs/verifies.
`middleware.ts` matcher `['/administrador/:path*','/api/admin/:path*']` (except the two `login`
routes) → redirect / 401 on missing/invalid cookie. OIDC later = a second `AuthProvider` impl.

| Screen | Route | Backing `/api/admin/*` |
|---|---|---|
| Login | `administrador/login` | `POST login`, `POST logout` |
| Catalog list (slug, program, variant, status, term, #courses, pairing counts, last import) | `administrador` | server-component DB read; per-row **Re-sync** button → `POST catalogs/[slug]/resync` |
| Upload (pensum xlsx + optional prereq xlsx) | `administrador/import` | `POST imports` → parse all 5 sheets, diff, create `ImportJob(status:"parsed")`, return `jobId` |
| Validation report + per-catalog field-level diff + pairing preview | `administrador/import/[jobId]` | `GET imports/[jobId]`; `POST imports/[jobId]/apply`; `DELETE imports/[jobId]/discard` |
| Manual-pairing queue — rows where `pairingStatus ∈ {needs_manual, not_offered, placeholder_pool, sync_failed}`; each row: Excel-prefilled fields, `suggestedCode`/`candidateCodes`, live API search widget, **Bind to <code>** / **Keep as placeholder** | `administrador/pairing/[slug]` | `GET course-search?term=&q=` (server proxy to `ofertadecursos`); `PATCH pairing/[id]` (sets `courseId`, `pairingStatus`, refreshes `CourseOffering`) |
| Snapshot list + one-click rollback | `administrador/snapshots/[slug]` | server-component read; `POST snapshots/[id]/restore` (writes `pre-restore` snapshot, then replaces `CatalogCourse` rows from `payload` in one transaction) |

Every mutating handler writes an `AuditLog` row.

---

## G. Docker & config

**`web/Dockerfile`** (multi-stage):
1. `deps` — `node:22-alpine`; `COPY package*.json`; `npm ci`.
2. `build` — copy source; `npx prisma generate`; `npm run build` (`next.config.mjs` →
   `output: 'standalone'`).
3. `runner` — `node:22-alpine`; non-root `node` user; copy `.next/standalone`, `.next/static`,
   `public`, `prisma/` (schema **+ migrations**), `node_modules/{prisma,@prisma,.prisma}`.
   `ENV NODE_ENV=production PORT=3000`; `VOLUME /data`; `EXPOSE 3000`; `USER node`;
   `HEALTHCHECK CMD wget -qO- http://localhost:3000/api/health || exit 1`;
   entrypoint script: `npx prisma migrate deploy && exec node server.js`.

**`docker-compose.yml`** (repo root): `web` service (build `./web`, port 3000, `env_file: .env`,
volume `pensum-data:/data`); `seed` service (same image, `profiles:["seed"]`, mounts
`pensum-data:/data` + `./:/repo:ro`, `command: ["npm","run","seed"]`) run via
`docker compose run --rm seed`; named volume `pensum-data`.

**Env vars**

| Var | Purpose | Example / default |
|---|---|---|
| `DATABASE_URL` | SQLite file on the volume | `file:/data/app.db` |
| `SESSION_SECRET` | admin cookie signing key | (random 32B) |
| `ADMIN_PASSWORD` | single shared admin password | — |
| `OFFERINGS_TERM` | default pairing term | `202620` |
| `MIHORARIO_URL` | "see the classes" deep-link base | `https://open-source-uniandes.github.io/Mi-Horario-Uniandes/` |
| `PUBLIC_BASE_URL` | absolute share/preview links | `https://pensum.<host>` |
| `PAIRING_CONCURRENCY` | pairing fetch fan-out | `4` |
| `UNIANDES_API_URL` | API override (testing) | `https://ofertadecursos.uniandes.edu.co/api/courses` |
| `SEED_DIR` | where `seed.ts` reads the 2 xlsx | `/repo` |
| `LOG_LEVEL` | | `info` |

**`web/scripts/seed.ts`** (run via `tsx`, `npm run seed`): reads the two repo `.xlsx` from `SEED_DIR`
→ `parsePensumWorkbook` + `parsePrereqExport` → upsert 5 `Catalog` rows + global `Course` rows +
`CatalogCourse` rows with parsed trees → `pairCatalog` each against `OFFERINGS_TERM`. Idempotent
(upsert by slug / `normalizedCode`; recreate `CatalogCourse`). Seeds catalogs as `status:"published"`
for immediate visibility in P0/P1; the coordinator can move them back to `draft` and use the
publish workflow thereafter. Fully replaces `build-data.mjs`.

---

## H. Phasing

- **P0 — pipeline / DB, no UI.** Prisma schema + first migration; port pure `lib/` modules; build
  `lib/import/*`, `lib/pairing/*`, `lib/shared-oferta/*`; `scripts/seed.ts`.
  **Exit:** `npm run seed` populates a fresh `app.db`; assertions in §I.1–2 pass.
- **P1 — student panel + variant selector.** Next shell; `globals.css` from the two old CSS files;
  port React Flow components + `PensumExplorer`; `CatalogPicker`; `/p/[slug]`; `GET /api/catalogs[...]`;
  per-slug `persistence.ts`; disclaimer; SidePanel offering badges.
  **Exit:** all 5 catalogs render with correct semester columns + prereq/coreq edges.
- **P2 — admin.** Auth + middleware; catalog list; upload → validate → diff → apply; manual-pairing
  queue + search widget; re-sync; snapshots + rollback; audit log.
  **Exit:** full upload walkthrough on a modified xlsx (§I.5).
- **P3 — Docker / deploy.** Dockerfile; compose; `migrate deploy` on start; healthcheck; volume
  persistence check; README runbook.

### Risks

| Risk | Mitigation |
|---|---|
| Parser doesn't fit all 5 sheets (DOBLE = 10–12 semesters, extra header words, wider/offset SEM columns) | sheet-name lookup table; extended `SEMESTER_HEADER_RE`; scan **all** columns > 7 for the credit marker (no hardcoded 8–16); per-sheet `parseReport` surfaced in the validation screen; human review of seed output before publish |
| University API shape drift / rate-limit / downtime | `sync_failed` degradation; per-term cache; concurrency ≤ 4; offerings are cosmetic and non-blocking; pin `SeccionAPI`; a CI contract test against one known course |
| SQLite write concurrency during import | single-writer design; WAL; `busy_timeout=5000`; whole `apply` in one `$transaction`; single shared admin login |
| Placeholder resolution quality | heuristics only *suggest*; everything unresolved lands in the manual queue prefilled from Excel; "Keep as placeholder" always valid |
| Term rollover | `OFFERINGS_TERM` env + per-`Catalog.term` + `CourseOffering` keyed by `(courseId, term)` so old data isn't clobbered; admin "Re-sync (term X)" with overridable term |

---

## I. Verification (end-to-end)

1. **Seed:** `rm -f /data/app.db && npm run seed`. Assert `Catalog` count = 5 and slugs =
   `{iele-cbu3, iele-cbu3-pc, ielc-cbu3, ielc-cbu3-pc, doble-cbu3}`.
2. **Pairing rates:** for `iele-cbu3`,
   `SELECT pairingStatus, count(*) FROM CatalogCourse WHERE isPlaceholder=0 GROUP BY 1` →
   ≈ 29 `auto_paired`, ≈ 5 `not_offered` (34 concrete IELE courses). All ~15 placeholders in
   `needs_manual` / `placeholder_pool`. `CourseOffering` has a row per concrete course for `202620`.
3. **Student render:** `npm run dev`; open `/p/iele-cbu3`. Semester 1 column shows IELE1118,
   MATE1203, ISIS1221, ESCR, CBU. `MATE1203` SidePanel prereq text renders
   `"(MATE 1201 o MATE1 o MATS1) y MATE 1203C*"` and draws in-catalog edges only. Progress mode: mark
   all of semester 1 → semester-2 courses flip to `available` / `one-away`. Load the other 4 slugs;
   `doble-cbu3` shows 10–12 semester columns.
4. **Offering badges:** SidePanel for `IELE2100` → "Se dicta", `sectionCount > 0`, Mi-Horario link
   resolves to `MIHORARIO_URL`. One of the not-offered courses → "No se ofrece este semestre".
5. **Admin round-trip:** log in with `ADMIN_PASSWORD`; upload a copy of the pensum xlsx with one
   course's credits changed and one course row deleted. Diff screen shows exactly that one modified
   field + one removed row. Apply → a `CatalogSnapshot(reason:"pre-import")` row exists and the catalog
   reflects the change. In the pairing queue, bind one `needs_manual` placeholder to a real code via
   the search widget → `pairingStatus='manual_resolved'`, renders as a real node on reload. Snapshots →
   Restore the pre-import snapshot → credits and the removed course revert.
6. **Container + volume:** `docker build -t pensum web/`; `docker compose up`; `GET /api/health` → 200.
   `docker compose run --rm seed`. Open `/p/iele-cbu3`. `docker compose restart web`; reload → catalog
   data and the manual pairing from step 5 survive (`pensum-data` volume). (Approved-course state is
   client-side localStorage by design.)
7. **API-down degradation:** point `UNIANDES_API_URL` at an unroutable host; run "Re-sync offerings" →
   import/catalog unaffected, affected rows show `sync_failed` + "Sin datos de oferta", no 500s.

---

## Critical files

- `app/scripts/build-data.mjs` — source of `tokenize()`/`parseExpr()` and the grid state-machine to lift into `web/lib/import/`
- `app/src/lib/availability.ts` — reused verbatim; defines the client contract that `prereqTree` JSON + `catalogPayload.ts` must feed
- `app/src/lib/types.ts` — ported + extended (`OfferingBadge`, `CatalogPayload`); `Course`/`ReqNode` anchor the data model
- `app/src/lib/requirementText.ts`, `app/src/lib/persistence.ts` — ported (persistence gains a `slug` arg)
- `app/src/App.tsx` — becomes `web/components/PensumExplorer.tsx`
- `app/src/components/{CurriculumGraph,CourseNode,SidePanel}.tsx` + `App.css` — carried over; poster CSS preserved
- `Mi-Horario-Uniandes/src/services/fetcher.ts`, `src/types/ofertaDeCursosAPI.ts`, `src/models/*` — copied into `web/lib/shared-oferta/`
- `pensum-interactivo-product-doc.md` — reference for catalog/import/publish semantics (its Python/Postgres stack is superseded)
