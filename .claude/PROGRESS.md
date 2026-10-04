# Pensum re-scope — progress log

Re-scope of `Custom_Pensum` from a build-time Vite React SPA into a Next.js full-stack
app: student panel + `/administrador` admin + Postgres DB + live pairing against the
Uniandes course API. Full approved design: [`.claude/PLAN.md`](./PLAN.md).

**Key decisions:** Next.js App Router, Postgres via Prisma (Neon in prod on Vercel,
local docker-compose `db` for dev — switched from SQLite-on-volume, see "Infra" below),
"see the classes" = link out to Mi-Horario (no timetable UI), `/administrador` gated
by `ADMIN_PASSWORD` env (no student-UI link), the Excel's 5 sheets = 5 selectable
catalogs. New app lives in `Custom_Pensum/web/`; old `Custom_Pensum/app/` kept as
migration reference until P1 fully closes, then delete.

## Done

**P0 — data pipeline + DB (complete, verified).**
- `web/` scaffolded: Next 15, React 19, Prisma (SQLite), `prisma/schema.prisma` +
  `20260901140254_init` migration.
- Pure modules ported as-is: `web/lib/{availability,requirementText}.ts`;
  `types.ts` extended (`OfferingBadge`, `CatalogPayload`); `persistence.ts` gains a
  `slug` arg (`STORAGE_KEY` = `pensum:${slug}:approved`).
- `web/lib/import/` — `requirementParser` (tokenize/parseExpr lifted verbatim from
  the old `build-data.mjs`), `normalizeCode`, `parsePensumWorkbook` (all 5 sheets),
  `parsePrereqExport`, `classifyPlaceholder`, `persistCatalog`.
- `web/lib/pairing/` — `pairCatalog` (concurrency-limited, degrades to `sync_failed`,
  never rolls back), `placeholderHeuristics`, `offeringsCache` (shared across catalogs).
- `web/lib/shared-oferta/` — API types + a focused fetcher (no Mi-Horario timetable code).
- `web/lib/catalogPayload.ts` — DB → `CatalogPayload`; edges derived from stored
  `prereqTree` JSON; `availability.ts` consumes it unchanged.
- `web/scripts/seed.ts` (replaces `build-data.mjs`) + `web/scripts/inspect.ts` (dev).
- Verified: `npm run seed` → 5 catalogs; `iele-cbu3` 28 auto_paired + 5 not_offered
  (33 concrete courses — `ESCR` is now a DEPT placeholder, hence 33 not 34), 40
  `CourseOffering` rows, `MATE 1203` prereq tree matches the old build.

**P1 — student panel (complete, verified in browser).**
- `app/layout.tsx` (+ `suppressHydrationWarning` for extension attrs), `app/globals.css`
  (old App.css + index.css + picker/offering styles), `app/page.tsx` (catalog picker),
  `app/p/[slug]/page.tsx` (server → `buildCatalogPayload` → `PensumExplorer`).
- API routes: `/api/health`, `/api/catalogs`, `/api/catalogs/[slug]` (ETag + `Cache-Control: max-age=300`).
- Components: `CurriculumGraph`, `CourseNode`, `SearchBar`, `SummaryBar` ported +
  `"use client"`; `SidePanel` gains the live-offering block (offered / sections /
  seats / attr+ptrm chips / "Ver secciones en Mi Horario →" deep link);
  `PensumExplorer` = old `App.tsx` body + variant `<select>` + disclaimer banner;
  progress hydrated in `useEffect` (SSR-safe).
- Verified in Chrome: picker → graph, course focus + prereq render + offering badges,
  Mi avance status colors + credits/critical-path, approve toggle, per-slug
  localStorage survives reload, `doble-cbu3` shows 9 semesters. `npm run build` passes.

**P1.5 — frontend design pass (complete, verified in browser).**
- **Catalog identity:** `Catalog` gains `accentColor / tagline / subtitle / imagePath`
  (migration `20260903130022_add_catalog_identity_and_electives`). Seeded from
  `web/lib/catalogIdentity.ts` (subtitle = semester count, computed in `seed.ts`).
  Placeholder header images in `web/public/assets/pensums/<slug>.svg` (+ README on
  swapping in real ones). Picker cards redesigned: image band + accent + tagline.
- **Electives in DB:** new `Elective` model + `web/lib/import/parseElectivesWorkbook.ts`
  (reads every `.xlsx` in `Custom_Pensum/electivas/`). Both pensum eras
  (`from2024` / `until2023`) × both programs (`ele*` / `elc*`) stored as a `roles`
  JSON blob (`{norm,raw}` per slot); `offeredTerms` flags the `202620` curated
  subset; pregrado + maestría (`level`, `ciclo`). `foldAccents`/`tokenSetRatio`
  moved to `web/lib/import/textMatch.ts`. Seed logs `51 electives (19 en 202620)`.
- **Payload:** `CatalogPayload` gains the identity fields, `electives: ElectiveDTO[]`,
  and `Course.placeholderKind/placeholderLabel` (all additive; `availability.ts`
  untouched).
- **Nav:** `app-header` restyled light + accent top rule; the variant `<select>` is
  now `web/components/PlanSwitcher.tsx` (grouped popover, outside-click/Esc).
- **Graph (`CurriculumGraph.tsx`):** Roman-numeral semester headers (`I…`) +
  alternating `semesterBand` nodes behind the courses; **edges are hidden until a
  course is selected**, then only that course's prereq/dependent chain is drawn.
- **Elective picker:** `web/components/ElectivePicker.tsx`, shown in `SidePanel`
  when an elective placeholder (`type==="electiva"` or kind ∈ ELECTIVA/EFI/CLE) is
  selected. Filters: era toggle, "Solo las de 2026-2" (default on), text search;
  narrows by slot label ("ÁREA MAYOR"/"INTEGRADOR"/"LIBRE"). IELE=18 vs IELC=19
  valid — program indexing confirmed (e.g. ARQ. SISTEMAS DIGITALES: IELE none /
  IELC obligatoria). Each row links out to Mi Horario by name (no code pairing yet).
- Verified in Chrome across `iele-cbu3`, `ielc-cbu3`, `doble-cbu3`; `npm run build`
  passes; no console errors.

**P1.6 — design pass round 2 (complete, verified in browser).**
- **Landing → rows.** `app/page.tsx` is now a thin server wrapper; the list lives in
  `web/components/CatalogPicker.tsx` (client). Cards became rows (thumbnail +
  badge + name + tagline + "Ver pensum →"). A prominent **Plan estándar ↔ Con
  Precálculo** toggle at the top filters which rows show (estándar = the 3 base
  plans incl. Doble; precálculo = the 2 PC variants); hidden when no PC variant
  exists.
- **Nav / search.** Search + type filter + "solo disponibles" collapsed behind a
  magnifier `icon-toggle` in the summary bar (`SearchBar` gets an `onClose`, a
  pink dot marks an active filter while collapsed).
- **Bigger pensum.** The right panel no longer renders until a course is
  selected, so the graph starts full-width. `panelOpen` state in
  `PensumExplorer`; `CurriculumGraph` refits (`RefitOnResize` child using
  `useReactFlow().fitView`) whenever it opens/closes. Collapse chevron (`›`) on
  the panel's left edge → `panel-reopen` tab (`‹`) on the far right edge.
- **Elective assignment (Mi avance).** `ElectivePicker` rows get "Elegir para
  este espacio" in progress mode → `GET /api/electives/resolve?q=&term=&program=`
  (new route: fans out over a few dept prefixes, fuzzy-matches the API title,
  returns `{code, title, credits, sectionCount}`). The assignment overrides the
  slot's **name + credits** (kicker/`displayCode` stays "IELE ELECTIVA");
  `PensumExplorer` applies it when building `courses`, so the graph node, credit
  totals and side panel all update. Persisted per-slug in localStorage
  (`pensum:<slug>:electivas`) and in the share hash (`&electivas=<base64>`);
  `persistence.ts` grew `loadElectivesFrom*/saveElectivesToStorage/buildShareUrl`
  (replaces `approvedToShareUrl`; hash is now `URLSearchParams`, old
  `#aprobadas=` links still parse). New `ElectiveAssignment` type.
- Verified in Chrome: rows toggle, search toggle, full-width start, panel
  open/collapse/reopen with refit, elective resolve (`AUTOMATIZACIÓN INDUSTRIAL`
  → `IELE3336`, 2→3 cr) surviving reload. `npm run build` passes; no console errors.

**P1.7 — prerequisite vs corequisite distinction (complete, verified in browser).**
- **Data.** `persistCatalog.ts` now parses `coreqText` into `coreqTree` (hyphens →
  spaces first, so lab companions `IELE-1118L` tokenize as `IELE 1118L`). Re-seed
  needed (`SEED_SKIP_PAIRING=1 npm run seed` is enough — no schema change).
- **Payload.** `catalogPayload.ts` derives `coreqCourseIds` / `coreqExternal`
  from `coreqTree` (mirrors the prereq block); `Course` gained `coreqTree` +
  `coreqExternal`. In the CBU3 sheets every coreq is an external lab/practice
  (`*L/*P/*T`), so `coreqCourseIds` is empty for all of them today — the wiring
  is there for catalogs that do have node-to-node coreqs.
- **Logic.** `courseAvailability(course, approved, catalogCodes, allCourses?)`:
  prereqs must be **approved**; a coreq only holds a course back when the coreq
  itself can't be co-taken this term (its own prereqs unmet). New
  `coreqBlockers` field; `PensumExplorer` passes `courses` to both call sites.
- **Visual.**
  - Graph: prereq edges are solid blue **with an arrowhead** (`MarkerType.ArrowClosed`,
    `#2563eb`, "pass before"); coreq edges are dashed amber, no arrow (`#d97706`,
    "same term"). A `<Panel>` legend (top-right) documents both. Selecting a
    course now also un-dims + draws edges to its direct coreqs (`coreqNeighbors`).
  - SidePanel: two colour-keyed sections — **Prerrequisitos** (blue rule,
    "deben estar aprobados antes") and **Correquisitos** (amber rule, "se ven al
    tiempo (o antes)"). "Te falta" splits into "Aprobar antes" and "Poder
    inscribir al tiempo". `requirementText.codeLabel` spaces bare external codes
    (`IELE1118L` → `IELE 1118L`).
- Verified: MATE 1203 → "Sin correquisitos"; IELE 2100 → coreq "IELE 2100L" shown
  separately from its prereq expression; blocked-course "Te falta" shows the
  "Aprobar antes" list. `npm run build` passes, no console errors.

**P1.8 — admin progression rules + reset (complete, verified in browser).**
- **Schema.** `Catalog.rules` Json column (migration `20260903153237_add_catalog_rules`),
  shape `{ gates: GateRule[], attestations: Attestation[] }` (types in `lib/types.ts`).
- **Authoring surface (for now).** `web/lib/catalogRules.ts` — a per-slug config
  map the seed writes into `Catalog.rules` (a future `/administrador` edits the
  same column). Default for the 5 CBU3 plans: a `idioma` attestation
  (`autoGatePrereqRegex: ^(LENG|ENGL|RLEC|IDIO)`) + one demo gate
  (`^(IELE|IELC)3\d{3}$` locked until every `^(IELE|IELC)2\d{3}$` is approved).
- **A — pattern gates.** `GateRule.appliesTo` (codeRegex / semesters / ids) +
  `condition` (AND of: `allApprovedMatching` regex, `maxApprovedSemester`,
  `minCredits`, `attestationId`). `availability.evaluateGates()` returns unmet-rule
  labels; `courseAvailability(..., ruleCtx)` forces `status:"blocked"` +
  `gateReasons[]` when non-empty. Bad regex ⇒ ignored (never throws).
- **B — attestations.** Self-checked, non-course requirements. An attestation with
  `autoGatePrereqRegex` locks any course whose prereq tree references a matching
  code until ticked (covers "language requirement met"). Checklist popover +
  "Requisitos n/total" button in `SummaryBar` (progress mode).
- **C — reset.** "Reiniciar avance" button in `SummaryBar` → `window.confirm` →
  clears approved + elective assignments + attestations for the slug
  (`persistence.resetProgress`). Per-plan only.
- **Wiring.** `PensumExplorer` holds `attestationsMet` (persisted
  `pensum:<slug>:requisitos` + `&requisitos=` in the share hash via
  `buildShareUrl(approved, assignments, attestations)`); computes
  `{statusById, lockedIds}` in one pass. `CurriculumGraph`/`CourseNode` render a
  🔒 + "Bloqueada por regla" (amber ring) for `lockedIds`. `SidePanel` shows a
  "Reglas del plan por cumplir" section and disables "Marcar como vista" while
  locked.
- Verified in Chrome (`iele-cbu3`): 9 courses locked initially (IELE 2100/2206 by
  the language auto-gate, seven IELE 3xxx by the nivel-2 gate); ticking `idioma`
  clears the two; the gate section + disabled approve button render for a locked
  course. Unit-checked: approving all IELE 2xxx clears the nivel-2 locks.
  `npm run build` passes, no console errors. `window.confirm` for reset can't be
  driven by browser automation — verified by code.

**P1.9-A — live prereq/coreq via `/api/courseDetails` (complete, verified).**
- **Discovery.** `GET /api/courseDetails?term=&ptrm=&nrc=` returns `prereq[].code`
  (same `O`/`Y`/`*` grammar as `requirementParser`), structured `coreq[]`
  (`{subject,coursenumber,title}`) and `restr[]` — none of which the `/api/courses`
  list carries. `nrc`+`ptrm` come from the section rows.
- **Fetch.** `shared-oferta/fetcher.ts` gains `urlCourseDetails` + `fetchCourseDetails`
  (`DETAILS_BASE` derived from `UNIANDES_API_URL` so the API-down test still
  redirects it). `offeringsCache.ts` memoises by `${term}:${nrc}`.
  `pairCatalog.ts` pulls details for each **auto_paired** course's lecture section
  (`rows[0]`), degrades to a `syncError`-tagged empty result, never trips the
  abort threshold. `opts.fetchDetails` / `SEED_SKIP_DETAILS=1` to skip.
- **Store.** Migration `20260906200413_add_course_details` adds to `CourseOffering`:
  `detailsNrc, apiPrereqText, apiPrereqTree, apiCoreq, apiCoreqTree, restrictions,
  detailsCompl, detailsMaster, detailsError, detailsSyncedAt`. Written in
  `persistCatalog.applyPairResult` (JSON-null clears stale values on re-seed).
- **Payload.** `catalogPayload.ts` prefers `apiPrereqTree`/`apiCoreqTree` over the
  `.xlsx`-derived trees when details were fetched OK; `PRERREQUISITOS` .xlsx is
  the fallback for not-offered courses. `Course` gains `prereqSource`/`coreqSource`
  (`"api"|"document"|null`), `coreqTitles`, `restrictions` (all additive;
  `availability.ts` untouched). `prereqText` follows the winning source.
- Verified: `npm run seed` → `details=28..31` per catalog, `sync_failed=0`, 33/40
  `CourseOffering` rows with details. `IELE2002` payload → `prereqSource:"api"`,
  `coreqExternal:["IELE2002T","IELE2002L"]` + `coreqTitles`, `restrictions:[NIVEL
  INCLUYE(SOLO) PREGRADO]`. Node-to-node coreqs still 0 in the 5 CBU3 catalogs
  (all coreqs are labs), but the wiring populates `coreqCourseIds` when present.
  Re-seed idempotent. `npm run build` passes.

### Deferred
- Seed-time `Elective.code` resolution (the on-demand route covers the student
  flow; a batch pass would let the picker show offering dots without a click).
- Admin editing of catalog identity + elective bag + progression rules
  (`Catalog.rules`) — all fold into P2, which now has three JSON columns to edit.
- `courseDetails.compl` / `.master` arrays are stored raw but unused.

**P1.9 — reviewer feedback round (complete, verified in browser).** Ordered:
**1 + 7 first** (shared "sole vs several prerequisite" logic), then 2–6 + course
descriptions. Details in
`~/.claude/projects/.../memory/feedback-round-improvements.md`.

- **1. Semáforo de prerrequisitos (done, verified in browser).** `CourseNode`
  no longer renders the `status-tag` text chip — colour is the whole signal.
  `availability.unlockRelation(dependent, selectedCode, catalogCodes)` →
  `"sole" | "among" | null`; `CurriculumGraph` builds `unlockById` for the
  selected course's direct dependents and passes `unlock` into node data +
  colours the leaving edges green (sole) / amber (among). `status-available` is
  now an explicit green ring, `status-one-away` an amber ring, `status-blocked`
  grey — `is-downstream` (transitive) demoted to a faint ring. Legend `<Panel>`
  gained a colour key (Verde / Amarillo / Gris / 🔒). SidePanel: coreqs render
  from `coreqExternal` + `coreqTitles` as a "debes inscribir al tiempo" list, a
  `req-restr` section shows `restrictions` chips, and a `requirement-source`
  line notes API vs document provenance.
- **7. "Mi avance" selección rápida (done, verified in browser).** `quickMode` +
  `staged` set in `PensumExplorer`; "Selección rápida" button in `SummaryBar`
  (progress mode) → green action bar with hint + "Terminar (N)" / "Cancelar".
  In quick mode a node click stages/unstages (non-placeholder, not-yet-approved;
  no panel, no dimming); nodes show `is-staged` (double green ring + "✓ marcada"
  chip). "Terminar" folds `staged` into `approved` and the graph recolours.
  Switching to Explorar cancels it. Verified: 0→13/134 credits after staging 5.
  On "Terminar", courses that flip to `available` get a one-shot `is-just-unlocked`
  animation (green `unlock-pop` glow + `unlock-glare` sweep, ~1.9s, cleared by a
  ref'd timer; `prefers-reduced-motion` respected). `justUnlocked` set lives in
  `PensumExplorer`, computed by diffing pre/post `courseAvailability`.
- **2. Curso Integrador (done, verified).** `BOLSA DE ELECTIVAS.xlsx` sheet
  `ELECTIVAS IEE` gained an "ES CURSO INTEGRADOR" column (0/1). Parser detects it
  by header text (`integradorColIndex`), `truthyFlag()` for 1/X/SI; new
  `Elective.isCursoIntegrador` (migration `20260906212731`). `ElectivePicker`
  gets `integradorOnly` → filters to the 7 flagged electives, drops role/era
  narrowing. `ELECTIVE_SLOT_KINDS` now `{ELECTIVA, EFI, CI}`; SidePanel passes
  `integradorOnly={kind==="CI"}`.
- **3. CLE (done).** SidePanel CLE branch (kind removed from `ELECTIVE_SLOT_KINDS`)
  → `ext-link-block`: "cualquier curso con código Uniandes … homologable" +
  link to `ofertadecursos.uniandes.edu.co`. No picker/search.
- **4. CBU (done).** SidePanel `isCbuSlot` branch → `ext-link-block` with link to
  `educaciongeneral.uniandes.edu.co/cbu/`.
- **5. Requisito de inglés (done, verified).** `catalogPayload.ts` injects one
  synthetic node `ENGLISH_REQ_ID` (`REQ. INGLÉS`, 0 cr, semester 5, bottom of the
  column, `placeholderKind:"REQING"`, slate colour). Courses whose
  `prereqExternal` matches `ENGLISH_REQ_CODE_RE` get it added to
  `prereqCourseIds` and the code stripped from `prereqExternal` (4 courses in
  `iele-cbu3`). Its "cumplido" state IS the `idioma` attestation: `PensumExplorer`
  derives `effectiveApproved = approved ∪ {ENGLISH_REQ_ID}` when
  `attestationsMet.has("idioma")` and feeds that to every availability/credits/
  critical-path calc. SidePanel has a dedicated `isEnglishReq` panel (description,
  info link to cienciassociales, Impacto, "Marcar como cumplido" → toggles the
  attestation). `autoGatePrereqRegex` **removed from the seeded `idioma`
  attestation** (the node now blocks); the field + `evaluateGates` support stays
  for future attestations.
- **6. "Checklist para grado" (done, verified).** New `app-header-actions` with a
  `grado-button` → `GradoChecklist` modal (Esc/backdrop close). Lists **three**
  attestations — `idioma` (lectura en inglés), `internacionalizacion`, `saberpro`
  (internacionalización and Saber Pro are *distinct* requirements) — with
  checkboxes + descriptions + CTA to
  `registro.uniandes.edu.co/index.php/formulario-de-graduandos`. Reuses
  `attestationsMet` / `handleToggleAttestation` (persisted + share hash already).
- **8. Course descriptions (done, verified).** Standalone scraper for
  smartcatalogiq — `lib/import/smartcatalog.ts` (fetch + parse, decodes the
  Windows-1252 pages + Latin-1 named entities) + `scripts/scrapeDescriptions.ts`
  (`npm run scrape:desc`, `scripts/scrapeDescriptions.md` docs). Harvests
  course-page URLs from the 2 EE program pages (year/level vary per course),
  fallback-constructs a URL otherwise. New `Course.description / descriptionUrl /
  descriptionSyncedAt` (migration `20260906222717`); the seed never touches them.
  `catalogPayload` puts `description` on `Course`; SidePanel renders a
  "DESCRIPCIÓN" block. Local run: 34/40 registry courses populated (the 6 misses
  are brand-new or wildcard codes not in the 2024/25 catalog).

**P1.9-B — DB is authoritative, Excel is import-only (done, verified).**
Everything discussed today had to be *mutable/editable over time*, not re-derived
from Excel or code on every seed. Changes:
- **`RequirementNode` model** (migration `20260906220510`): one row per catalog
  for the English-reading requirement (`key, label, description, infoUrl,
  credits, semester, sortIndex, attestationId, linkedCourseCodes, autoLinkRegex`).
  `catalogPayload.ts` builds the node from this row (position, label, link,
  attestation all editable) instead of synthesizing it; auto-attach still works
  via `autoLinkRegex`, plus an explicit `linkedCourseCodes` list. `Course` gains
  `requirementAttestationId / requirementInfoUrl / requirementDescription`;
  `PensumExplorer.effectiveApproved` and the SidePanel `isEnglishReq` panel are
  now data-driven (no `ENGLISH_*` constants in the components). Payload also
  exposes `requirementNodes: RequirementNodeDTO[]`.
- **`CatalogCourse.manuallyEdited` + `lockedFields`** columns (schema-ready for
  the P2 diff/apply; unused at runtime yet).
- **`persistParsedCatalog` is now non-destructive by default.** `Catalog.rules` /
  identity / `RequirementNode` rows are only written on first load (or with
  `SEED_RESET_META=1`); `CatalogCourse` rows are only rebuilt on first load (or
  `SEED_REBUILD_COURSES=1`) — otherwise the DB rows (incl. admin edits) are kept
  and only pairing/offering data is refreshed. `Elective.isCursoIntegrador` is
  create-only too. `lib/requirementNodes.ts` = first-load bootstrap, like
  `catalogRules.ts` / `catalogIdentity.ts`.
- Verified: re-seed shows "49 courses (kept)", `RequirementNode` not duplicated;
  a hand DB edit to `MATE 1203` (name/credits/`manuallyEdited`) and to a
  `RequirementNode` (semester/label) both survived a full `npm run seed`.
  `SEED_RESET_META=1 SEED_REBUILD_COURSES=1` re-derives from Excel on demand.

**P1.9-C — coordinator import templates (proposed + generated).**
`npm run export:templates` (`scripts/exportTemplates.ts`, exceljs) →
`plantillas/PLANES.xlsx` + `plantillas/ELECTIVAS.xlsx`, populated from the DB
(original-Excel structure + API-synced prereqs). Flat "one row = one course/slot"
with `Semestre` as an explicit column (replaces the wide `PENSUMS` grid + its
stale SEM-marker bug). `PLANES.xlsx`: 5 plan sheets + `_CATALOGOS`,
`_REQUISITOS_GRADO`, `_NODOS_REQUISITO`, `_INSTRUCCIONES`. `ELECTIVAS.xlsx`:
one row per elective with the 4 role columns + `Es Curso Integrador`. Dropdowns,
per-semester banding, frozen panes, red highlight on blank `Semestre`, subtotal
rows. Format/diff contract in `scripts/exportTemplates.md`. These are the input
format for the P2 importer (not consumed by the current `seed.ts`).

**P2.1 — admin auth + shell + catalog list (done, verified).**
- `lib/auth/session.ts` — Edge-compatible signed cookie (`pensum_admin`,
  HMAC-SHA256 via Web Crypto, 12h TTL, `SESSION_SECRET`). `lib/auth/password.ts`
  — timing-safe compare vs `ADMIN_PASSWORD`. `middleware.ts` gates
  `/administrador/:path*` + `/api/admin/:path*` (login/logout public) → redirect
  to `/administrador/login?next=` or 401 for `/api/admin`.
- `app/api/admin/{login,logout}/route.ts` (nodejs runtime). Login page
  `app/administrador/login/page.tsx` (client form, JSON POST).
- Shell: `app/administrador/layout.tsx` (pass-through + `admin.css`, scoped to
  `.admin-root`, `robots: noindex`) → `(panel)/layout.tsx` (sidebar
  `components/admin/AdminNav.tsx` — Catálogos / Importar / Electivas / Requisitos
  de grado / Auditoría + logout). Login sits outside the `(panel)` group so it
  has no sidebar.
- `(panel)/page.tsx` — catalog list (server, `force-dynamic`): programa·variante,
  estado badge, término, #cursos + #requirement nodes, pairing-status breakdown,
  "Editar" → `(panel)/catalogos/[slug]/page.tsx` (stub for P2.2).
- `lib/audit.ts` — `writeAudit()` (never throws).
- Verified by curl: unauth → 307 to login; wrong pw → 401; `dev-admin` → cookie +
  200; authed list renders; logout → cookie cleared → 307. `npm run build` passes
  (`ƒ Middleware` registered). Screenshot of login + list confirmed.

**P2.3 — Excel import → diff → apply (done, verified).**
- `lib/import/parsePlanesWorkbook.ts` — parser for the flat template (`PLANES.xlsx`):
  5 plan sheets → `ParsedPlanCourse[]` (`Semestre` explicit, `Total …` rows +
  `_INSTRUCCIONES` skipped), `_CATALOGOS` / `_REQUISITOS_GRADO` / `_NODOS_REQUISITO`
  → config. Uses `xlsx` (SheetJS), not `exceljs` (that's a devDep, prod code
  can't use it).
- `lib/import/diffPlanes.ts` — `buildPlanesDiff(parsed, prisma)`: field-level
  diff. Course key = `normalizedCode` (real) / `${kind}#${sem}#${n}` (placeholder).
  A changed field is a **conflict** when it's in the DB row's `lockedFields`;
  `manuallyEdited` rows flag removals as conflicts. `prereqText` diffs only when
  the sheet cell is non-empty. `export:templates` fixed to write
  `CatalogCourse.prereqText` (the fallback text the diff compares), not the
  API-merged payload text.
- `lib/import/applyPlanes.ts` — `applyPlanesJob(jobId, {confirmRemovals,
  forceConflicts})`: re-diffs live, snapshots every affected catalog
  (`reason:"pre-import"`), then one `$transaction`: upsert catalogs, courses
  (add/modify/remove by key, skipping conflicts unless forced), `RequirementNode`
  (global → every affected catalog), rebuild `Catalog.rules` from
  `_REQUISITOS_GRADO`. New courses land `needs_manual` (P2.4 re-sync pulls
  offerings — no API call here). `discardImportJob()`.
- Routes: `POST /api/admin/imports` (multipart, `planes` field → parse + diff +
  `ImportJob`), `.../[jobId]/apply`, `.../[jobId]/discard`.
- Screens: `(panel)/importar/page.tsx` (`ImportUploader` + recent jobs),
  `(panel)/importar/[jobId]/page.tsx` (diff render: per-catalog identity /
  added / modified with before→after / removed, requirement nodes, grad rules;
  `ImportActions` client with the two checkboxes + Aplicar/Descartar).
- Verified end-to-end: uploaded a mutated `PLANES.xlsx` (credits, semester, name,
  tagline, +1 grad requirement) → diff showed exactly those (`1 nuevo, 3
  modificados, 0 conflictos`) → Aplicar → DB reflected all changes + 5
  `pre-import` snapshots + job `applied`. DB restored afterwards. `npm run build`
  passes.

**Infra — Postgres + Vercel preview (superseded by MySQL below; kept for history).**
- Had `schema.prisma` on `provider = "postgresql"` with a pooled `DATABASE_URL` +
  direct `DIRECT_URL` (Neon/PgBouncer split), a squashed `*_init_postgres`
  migration, a `postgres:16` docker-compose `db` service, and a `vercel-build`
  script for Neon on Vercel. Verified working locally but **never run against
  the real Neon DB / deployed** before the engine swap below.

**Infra — MySQL swap (complete, verified locally).**
- **Why.** University policy mandates MySQL — Postgres/Neon is out.
- **Provider swap.** `schema.prisma` `provider = "mysql"`, single `DATABASE_URL`
  (no `directUrl` — that split was Neon/PgBouncer-specific, MySQL doesn't need
  it). Models unchanged, but free-text fields (course/elective names, prereq
  expression text, descriptions, error/note strings) gained explicit
  `@db.VarChar(500)` / `@db.Text` — Prisma defaults bare `String` to
  `VARCHAR(191)` on MySQL (utf8mb4 index-length legacy), which would silently
  truncate anything longer. The old Postgres migration is archived verbatim
  under `web/prisma/_archive_postgres_migrations/` (outside Prisma's path,
  alongside the earlier `_archive_sqlite_migrations/`); `web/prisma/migrations/`
  now holds one fresh `20260924030026_init_mysql` (generated live via `prisma
  migrate dev` against the local container, not offline-diffed like the
  Postgres one was).
- **Local dev.** Root `docker-compose.yml` `db` service is now `mysql:8.4`
  (named volume `pensum-mysqldata`, user/db `pensum/pensum/pensum`, root pw
  `pensum`), healthcheck via `mysqladmin ping`. Note: `mysql:8.4` **dropped**
  the `--default-authentication-plugin` flag (used on 8.0) — omit it, don't
  resurrect it. `.env.example` / `.env` now carry one MySQL `DATABASE_URL`
  (`mysql://pensum:pensum@localhost:3306/pensum`). `prisma migrate dev` needs a
  shadow DB, so the `pensum` user needs `CREATE`/`DROP DATABASE` — the default
  compose grant only covers the `pensum` schema, so a fresh container needs
  `GRANT ALL PRIVILEGES ON *.* TO 'pensum'@'%'` run once via `docker compose exec
  db mysql -uroot -ppensum -e "..."` before the first `prisma migrate dev`
  (`prisma migrate deploy` in normal/CI use doesn't need this).
- **Vercel / prod hosting is still open.** The `vercel-build` script and Vercel
  env vars are unchanged in shape (`DATABASE_URL` + the rest) but now need to
  point at a real hosted MySQL (PlanetScale, RDS, self-hosted, etc. — not yet
  chosen); `DIRECT_URL` is no longer read anywhere and can be dropped from the
  Vercel project env whenever convenient. Not yet deployed against a prod MySQL.
- **Raw SQL.** `scripts/inspect.ts` rewritten for MySQL (backtick-free
  unquoted camelCase idents — MySQL is case-preserving but not
  case-sensitive on identifiers by default, unlike Postgres's `"quoted"` —
  `CAST(... AS SIGNED)` instead of `::int`). Aggregate `COUNT`/`SUM` come back
  as `BigInt` over `$queryRawUnsafe` on MySQL (prints as `28n` in
  `console.table`) — cosmetic, dev-only script, not fixed.  `lib/db.ts`
  `applySqlitePragmas()` still self-guards on a `file:` URL → dormant no-op.
- Verified locally against `mysql:8.4`: `prisma migrate dev` clean, `npm run
  seed` → identical counts to the Postgres run (iele-cbu3 28 auto / 5
  not_offered, 51 electives), `npm run build` passes, `npm run dev` smoke-tested
  — `/api/health` `{"ok":true,"db":"up"}`, `/api/catalogs`, `/p/iele-cbu3` (200),
  and the admin login → authed `/administrador` (200) all work end-to-end.

**Session 2026-09-24 — click-selection fix, Mauricio's JSON pensum exports reconciled + applied to prod, masters catalogs added.**
- **Bug fix (`MapCanvas.tsx`).** The hover-dimming flicker fix (same session,
  earlier commit) had added `selectable: false` to `courseCard` nodes on top
  of the pre-existing `draggable: false`. React Flow derives a node's CSS
  `pointer-events` from `isSelectable || isDraggable || onNodeClick || ...`
  (the top-level `<ReactFlow>` handler props — none of which this app sets,
  since clicks/hover go through `data.onClick`/`data.onHover` on the
  `CourseCard` button instead). With both false, React Flow set
  `pointer-events: none` on the whole node, silently swallowing clicks.
  Removed the stray flag. Pushed to `main` (`5a98659`) and mirrored via PR to
  `fg-edu-tep/pensum-interactivo#1` (the fork Vercel deploys from).
- **`electivas/{iele,ielc,m-iele,m-maia}.json`** — new source files: exports
  from a platform the coordinator (Mauricio) is piloting, richer than the
  `.xlsx` pipeline (stable rule IDs, `course`/`pool`/`group` rule types,
  precise elective code ranges instead of free-text names). Added to the
  repo as source data alongside the existing `.xlsx` files.
- **Trust hierarchy defined and applied:** live Uniandes API > this JSON >
  legacy `.xlsx`, with case-by-case overrides where corroborating evidence
  disagreed (full reasoning + every verified conflict in
  `~/.claude/projects/.../memory/electivas-json-trust-hierarchy.md`). Found
  and fixed one real bug in our own `PENSUMS PREGRADO` sheet (`ielc-cbu3`'s
  semester-6 slot was coded `IELE3106` — Electrónica de Potencia — but should
  have been `IELE3200` — Electrónica Análoga) and one stale course code
  (`IELE2150` → `IELE2110`, confirmed via a live API pull that the old code
  no longer exists). Also caught JSON-side errors (wrong credits on
  `IELE3106`/`IELE1200`/`IELE2202`, an internal inconsistency between
  `iele.json` and `ielc.json` on `IELE1200`'s credits, and an impossible
  term-1 placement for `MATE2210` given its own prerequisite chain) — none of
  those were applied.
- **Applied directly to the Neon production DB** (ad-hoc scripts run via the
  Vercel-linked project + `vercel env pull`, not yet a real importer —
  `CatalogSnapshot` written per catalog first, `AuditLog` entry per change,
  actor `claude-code:*`): 3 new `Course` rows (`MATE2301`, `IELE3200`,
  `IELE2110`), 13 `CatalogCourse` rebinds across all 5 CBU3 catalogs
  (`manuallyEdited: true` so a future re-seed won't touch them), 7 stale
  `ManualPairing` rows dropped. One item deliberately left `needs_manual`:
  `doble-cbu3`'s `IELE 1X18` slot — a genuine either/or between
  `IELE1118`/`IELE1218` for the combined program that no source resolves.
- **Two new published catalogs**, built straight from the JSON since neither
  existed before (pure addition — nothing to conflict with): `m-iele`
  (Maestría en Ingeniería Eléctrica, id 6, 40cr, 6 rows) and `m-maia`
  (Maestría en Inteligencia Artificial, id 7, 36cr, 12 rows). Both credit
  sums verified exact against `program.totalCredits`. `accentColor`/
  `tagline`/`imagePath` left null — no design pass done, so their picker
  cards render plain until that happens.
- **Schema gap surfaced, not yet built:** the JSON's `pool` (elective by
  code-range, e.g. `IELE-3230:3299`) and `group` (`"choose 2 of 3"`) rule
  types have no first-class `CatalogCourse` equivalent. Every pool/group in
  this session was represented as one descriptive `ELECTIVA`/`CLE`
  placeholder row carrying its aggregate credit target + range in
  `placeholderLabel` (same convention as the existing pregrado "Electivas de
  Programa" pools) — workable, but loses precision a real importer should
  capture structurally. See "Next" below.

**Session 2026-09-30 — explorer hover-flicker fix + Banner/Registro master-Excel prereq pipeline.**

- **Distinguish "unverified" from "not offered" in the offering box
  (`components/explorer/SidePanel.tsx`, `components/legacy/SidePanel.tsx`,
  `app/globals.css`, `components/explorer/explorer.module.css`).**
  `offering === undefined` (pairing never ran/confirmed anything for this
  course) was rendering identically to `offering.offered === false` (the
  live API confirmed zero sections this term) — same grey box, same "No se
  dicta" text, even though the first case is "we don't know" and the second
  is "we checked and it's not happening." Added a third `unknown` state
  (hollow dot, dashed box border, "Sin verificar en la oferta en línea") in
  both the new explorer and legacy `SidePanel`, so a course that was never
  paired doesn't get quietly misreported as confirmed-not-offered.
- **Explorer hover-flicker fix (`components/explorer/MapCanvas.tsx`).** Reported
  independently of the 2026-09-24 review meeting: rapidly sweeping the cursor
  across the course grid in the new `/p` explorer flickered / briefly went
  blank. Root cause: `handleHover` called `onHover(id)` — which feeds
  `hoveredId` into the `useMemo` that rebuilds the highlighted nodes/edges —
  on *every* `mouseenter`, so crossing a dozen cards a second tore down and
  rebuilt the highlighted-edge set at the same rate. Confirmed by
  instrumenting the live page: a synthetic 60-card sweep produced continuous
  edge-count churn (`0→7→0→5→0…`, changing every 15-30ms) while node count
  stayed flat. Fix: debounce the *commit* of a new hover target by 70ms
  (clearing immediately on mouse-leave so nothing lingers); the existing
  250ms tooltip-position debounce is untouched. Re-verified after the fix:
  the same 60-card sweep produces **zero** edge churn, while pausing on a
  single card still commits the highlight normally. Confirmed the legacy
  `/v1` view has no hover-driven code path at all (`CourseNode.tsx` /
  `CurriculumGraph.tsx` — no `onMouseEnter` anywhere), so this bug and fix
  are scoped to the new explorer only. `npm run build` passes.
- **Banner/Registro master Excel as the prereq/coreq/name/credits source
  (`lib/import/parsePrereqExport.ts`, `scripts/seed.ts`).** Mauricio's
  official Registro export landed at the repo root as `Excel_Registro.xlsx`
  (sheet `Export`, ~116,700 rows, every term back to ~2004 — replaces the
  old pre-filtered `PRERREQUISITOS TODOS 202620.xlsx`, 2900 rows / one term).
  Same column schema, so the existing parser mostly worked — but found a
  real landmine before shipping it: **within the master file a course code's
  rows are not chronological — newest period first** (e.g. `IELE-1002`:
  `202620, 202610, 202520, … 200620`). The old parser's `map.set(code, …)`
  "last row wins" logic, correct for the old single-term file, would have
  silently kept each course's *oldest* prereq/credits/name on file (in some
  cases a ~2007 snapshot) instead of the current one. Fixed:
  `parsePrereqExport(buffer, term)` now takes an explicit term and skips any
  row whose `Periodo` doesn't match it before building the map; `seed.ts`
  passes `OFFERINGS_TERM` (default `202620`) through. Verified two ways: (1)
  a direct parser call against `Excel_Registro.xlsx` at term 202620 — e.g.
  `IELE3200` ("Electrónica Análoga") prereq resolves to `IELE 2206`, *not*
  `IELE 2100`, confirming Mauricio's B-2 correction (Análoga doesn't depend
  on Elementos) holds once a pensum slot actually points at the right code;
  (2) a full local `SEED_REBUILD_COURSES=1 npm run seed` against the local
  docker Postgres — 2624 rows at term 202620, all 5 catalogs at their prior
  course counts, no crashes/warnings beyond the pre-existing known SEM
  column quirk (see Gotchas).
- **`findFile()` hardened (`scripts/seed.ts`).** Previously assumed exactly
  one file matches each glob; with both the old and new prereq files
  present at once that silently depended on filesystem directory-listing
  order. Now: multiple matches log a loud warning and deterministically
  prefer `Excel_Registro*` over `PRERREQUISITOS*` rather than picking
  whichever the FS happens to list first.
- **Repo cleanup.** Removed the now-superseded `PRERREQUISITOS TODOS
  202620.xlsx` (tracked, 2900-row single-term file) and an untracked
  byte-identical duplicate of the master file (`Prerrequisitos UA
  202620.xlsx`) — confirmed via `md5sum` before deleting. `Excel_Registro.xlsx`
  is now the sole, canonical prereq-export input at the repo root.
  `CLAUDE.md`'s source-data bullet updated to match and to spell out the
  pensum-structure vs. prereq-data split (D-3 in the 2026-09-24 review).
- **Found, not fixed: the actual B-2 root cause lives in the *pensum*
  Excel, not the prereq one.** `PENSUMS PREGRADO (DOCUMENTO BASE)) CBU3.xlsx`
  (unchanged, still the department's tracked file) still places `IELE3106`
  ("Electrónica de Potencia") in the semester-6 slot of `iele-cbu3` /
  `ielc-cbu3` where it should be `IELE3200` ("Electrónica Análoga") — this
  is *which course occupies which slot*, D-3's other, separate input, and
  `Excel_Registro.xlsx` can't fix it by itself. The 2026-09-24 session
  patched this directly on the **Neon prod DB** via an ad-hoc script
  (`manuallyEdited: true`), but that patch was never written back into the
  tracked `PENSUMS…xlsx` — so today's rebuild reproduced the mislabeling
  locally (now correctly surfaced as "Electrónica de Potencia," rather than
  silently papered over), and running `SEED_REBUILD_COURSES=1` against
  **prod** as-is would discard that session's hand patches (13
  `CatalogCourse` rebinds, 3 new `Course` rows, 7 dropped `ManualPairing`
  rows) since none of them are reflected in the tracked source Excel.
  **Not done today, deliberately:** touching the Neon prod DB. Everything
  above was verified only against the local docker-compose Postgres. Before
  a `SEED_REBUILD_COURSES=1` run against prod: either get Mauricio's
  corrected `PENSUMS` Excel (M-2) so the rebuild reproduces the same fixes
  structurally, or re-apply the 2026-09-24 hand patches after rebuilding.

**Session 2026-10-03 — admin auth rework: multi-user accounts + one-time setup +
12-word master-secret super-panel (done, verified end-to-end). Branch
`admin-auth-and-experience` off `mysql-migration`.**
Replaces the single shared `ADMIN_PASSWORD` with DB-backed accounts. Designed for
the Docker monolith deploy (app + MySQL in one stack). Full doc:
[`docs/admin-auth.md`](../docs/admin-auth.md).
- **Schema** (migration `20261003221513_add_admin_auth`): `AdminUser`
  (username unique/lowercased, scrypt `passwordHash`+`passwordSalt`, `disabled`,
  `mustReset`, `lastLoginAt`, `displayName`), `AdminSetting` (key/value — rows
  `master_secret_hash`/`_salt`, `setup_completed_at`), `PasswordResetToken`
  (reserved for a future token-link reset; unused today — recovery goes through
  the super-panel).
- **Crypto** (`lib/auth/`): `password.ts` rewritten to **scrypt** (`node:crypto`,
  N=2¹⁵, per-secret salt) — `hashSecret`/`verifySecret`, `passwordPolicyError`
  (min 8). `mnemonic.ts` + bundled canonical 2048-word `bip39Wordlist.ts` →
  real **BIP39** 12-word phrase (128-bit entropy + 4-bit SHA-256 checksum);
  `generateMnemonic`/`normalizeMnemonic`/`isValidMnemonic`. The old env-based
  `checkAdminPassword`/`adminPasswordConfigured` are gone. `users.ts` =
  all AdminUser/AdminSetting data access (`isInitialized`, `completeSetup`,
  `authenticate`, `verifyMasterSecret`, `rotateMasterSecret`, user CRUD,
  `changeOwnPassword`, `adminResetPassword`).
- **Sessions** (`session.ts`): two signed Edge-safe HMAC cookies — `pensum_admin`
  (payload carries the **username**, 12h) and `pensum_super` (master-secret
  unlock, 30 min). `actor.ts` `currentActor()` reads the username; `writeAudit`
  now **auto-resolves the actor** from it when not passed, so every existing
  mutation call site attributes to the real user with zero changes.
- **Bootstrap:** `/administrador/setup` is public **only while uninitialized**
  (zero users + no `setup_completed_at`) — **first-visitor-wins**, no SETUP_TOKEN
  (chosen for the trusted single-tenant monolith). Creates the first user,
  generates the master secret, shows it once (ack required), writes
  `setup_completed_at`, logs the user in. After that it redirects to login / API
  returns 409.
- **Login/middleware:** login is username+password (case-insensitive); middleware
  gates `/administrador/*` + `/api/admin/*`, lets setup/login/logout through, and
  additionally requires `pensum_super` for the super area (`/administrador/super`
  landing + `/api/admin/super/unlock` excepted so you can get the cookie).
- **Super-panel** (`(panel)/super/`): unlock via 12 words → list/create/enable/
  disable/delete users, **reset a user's password** (sets `mustReset`, super-admin
  hands temp pw out-of-band), **rotate the master secret** (new phrase shown once,
  old stops working). Lockout guards: can't delete the last user or disable the
  last active one.
- **Self-service** (`(panel)/cuenta/`): change own password (verify current,
  clears `mustReset`). No email reset (no SMTP) — locked-out users recovered by
  the super-admin.
- **Env/docs:** `ADMIN_PASSWORD` removed from `.env.example` + `.env` (unused now);
  `SESSION_SECRET` stays. New `docs/admin-auth.md`; `docs/README.md`, `CLAUDE.md`,
  `docs/branches-and-releases.md` updated.
- **Verified:** `npm run build` passes (all new routes + 34.7 kB middleware
  registered). Full dev-server flow via Invoke-WebRequest with a cookie jar:
  uninitialized→setup (12-word phrase + cookie)→initialized→setup-lockout(409)→
  login(wrong 401 / correct 200, case-insensitive)→authed(200)→super-API-without-
  cookie(403)→unlock(wrong 401 / right 200 + super cookie)→list/create user(200)→
  dup(409)→reset-password→login shows `mustReset:true`→self-change(wrong-current
  401 / correct 200)→re-login `mustReset:false`→delete non-last(200)/last(409)→
  disable-last-active(409)→rotate master (old phrase 401, new 200). `AuditLog`
  rows confirmed attributed to `felipe`/`mauricio` (not generic `admin`) across
  setup/login/unlock/create/reset/change/delete/rotate. Local auth tables reset
  to uninitialized afterward.

**Session 2026-10-04 — admin experience, Phase A: Registro import wizard (done, verified; not committed). Branch `admin-auth-and-experience`.**
Phase B (separate drag-and-drop authoring canvas; the student `MapCanvas`/`PensumExplorer` are deliberately untouched) is next. Full doc: [`docs/admin-registro-wizard.md`](../docs/admin-registro-wizard.md).
- **What it does:** `/administrador/registro` — upload `Excel_Registro.xlsx` → scope (last 3 *regular* terms, detected from department rows so the future `202701` doesn't count) → resolve unmatched codes → link/diff per catalog → apply → undo. Reduces ≈117k rows to ≈83 dictionary entries (65 department + 18 referenced).
- **Key finding:** IELC has no code prefix and the program-restriction column is empty, so IELE/IELC can only be scoped by department (`INGEN. ELECTRICA Y ELECTRONICA` + legacy `INGENIERIA ELECTRONICA`) plus a one-level closure of referenced codes.
- **16 blocking decisions on the real file** (5 bound-but-absent codes + 11 department-referenced stale codes); other departments' stale alternatives are informational.
- **Write safety:** single transaction; `pre-registro` snapshot per changed catalog; never sets `manuallyEdited`; replace/drop/rebind choices pin `lockedFields`; `manuallyEdited`/locked rows are skipped unless "forzar"; **undo** restores exact row state (the snapshot can't — it stores the student view, where live API prereqs beat document text), all-or-nothing, including SQL `NULL` vs JSON `null`.
- **Data:** migration `20261004011952_add_registro_import` (`RegistroImport`, `RegistroCourse`; additive). `lib/registro/*`, `app/api/admin/registro/*`, `components/admin/registro/*`. New `npm run test`.
- **Verified:** 75 unit tests (incl. 9 on the real file; mutation check), 36 service-integration checks, 35 browser E2E checks (Edge/puppeteer-core), scratch DB vs real DB = 0 differing `CatalogCourse` rows after apply+undo. Real local DB never written. Bugs found along the way are listed in the doc.
- **For Phase B:** the student payload prefers live API prereqs over the stored document text, which is what this wizard writes — Phase B needs an explicit precedence rule for admin-authored edges. Applying registro to the seeded catalogs is currently a no-op (same source as the seed). One local row is `manuallyEdited` (ielc-cbu3 `IELE3200`, the 2026-09-24 patch) and is skipped by the wizard.
- **Windows gotchas:** editing UTF-8 with PowerShell `Get-Content/Set-Content` double-encodes accents; piping `mysqldump` through PowerShell corrupts them too (copy DBs inside the container).

**Session 2026-10-04 (cont.) — discrepancy alerts: document vs official API (done, verified). Same branch.** Full doc: [`docs/admin-discrepancies.md`](../docs/admin-discrepancies.md).
- **Confirmed intended precedence:** students get the API tree when it exists; if the API synced fine but lists no requirement → none (document ignored); only otherwise the document (`CatalogCourse.prereq*/coreq*`). ≈ 85 % of courses are API-governed, so Registro imports and manual edits are invisible to students for most courses. Mirrored (not refactored — `catalogPayload.ts` untouched) in `lib/discrepancy/report.ts` and **locked to the real payload** by `payloadEquivalence.test.ts`.
- **Alerts:** new `/administrador/discrepancias` (sidebar), `⚠ N` badge per plan in the catalog list, inline alert + "students won't see this edit" warning in the course editor, and in the Registro wizard: Resolver warns when the official API still lists a "missing" code (`FISI1028` is **not** retired — fixed the misleading help text), Vincular/Aplicar mark each change as visible / agrees with API / differs and won't be seen. One component, one wording function, read-only.
- **Statuses:** match · soft-only (`*` only) · differs (warn) · doc-hidden (warn) · api-only · unverified (reason). Cause: pinned 🔒 / edited / imported. Trees compared canonically (order/nesting/duplicates ignored).
- **Real data:** 10 warnings per plan — 5× `FISI1028` drops from Registro run #1 (pinned), 4× `MATE…C*` suffix tokens (imported, pre-existing), 1× `IELE2002` coreq `IELE2002T` (pre-existing). None change what students see today.
- **Found in the student payload (reported, not changed):** `coreqText` is always the document's and `BasketModal` prints it, so a document corequisite can reach students in the basket even when the API governs; and `prereqText` keeps the document text when the API says "none" (tree empty).
- **Verification:** 115 unit tests; equivalence with `buildCatalogPayload` on all courses (real DB + a scratch copy with planted edge cases — the real data alone did **not** catch a deliberate mutation, the planted data does); 29 browser checks (counts on page = chips = badges); real-data report read-only.
- **Lessons:** run mutation checks *sequentially* (edit → run → restore → run) — a batched edit+test can race; real data doesn't exercise rare branches, plant scenarios.
- **Phase B precedence proposal (needs a decision):** a field pinned in `lockedFields` wins over the API; otherwise API, then document.

## Next


**Apply the Excel_Registro-based rebuild to prod, correctly.** Get Mauricio's
corrected `PENSUMS PREGRADO` Excel (the `IELE3106`→`IELE3200` slot fix, M-2)
before running `SEED_REBUILD_COURSES=1` against Neon — otherwise it silently
reverts the 2026-09-24 hand patches described above. Once the corrected
pensum Excel is in, cross-check every row against the rendered pensum (D-2)
before treating the rebuild as safe to run on prod.

**P2.2 — direct editors** (DB-authoritative CRUD): catalog identity + `Catalog.rules`
(attestations/gates) form; `CatalogCourse` table editor (every field, add/remove,
reorder, `manuallyEdited` + per-field `lockedFields`); `RequirementNode` CRUD;
`Elective` table. Each mutation → `writeAudit` + set `manuallyEdited`. The stub at
`(panel)/catalogos/[slug]/page.tsx` is where this lands.

**P2.4 — manual-pairing queue + re-sync.** Queue of `pairingStatus ∈
{needs_manual,not_offered,placeholder_pool,sync_failed}`; `GET
/api/admin/course-search` proxy; bind-to-code / keep-as-placeholder;
`POST /api/admin/catalogs/[slug]/resync` → `pairCatalog` with `fetchDetails`
passthrough + a details-only re-pull.

**P2.5 — snapshots/rollback + `AuditLog` viewer.**

**Real JSON importer for `electivas/*.json`.** Today's application to prod
was hand-scripted (see 2026-09-24 session above). A proper path needs:
schema support for `pool` (code-range elective) and `group` (N-of-M) rules
— today both get flattened into one descriptive placeholder row, losing
structure — plus the field-level trust-hierarchy resolution (live API > JSON
> xlsx) wired into `persistCatalog.ts`/`applyPlanes.ts`'s existing diff/apply
flow instead of a one-off script, so future re-exports from Mauricio's
platform go through the same reviewable `ImportJob` path as a `.xlsx`
upload.

**P3 — Docker.** Multi-stage `web/Dockerfile` (`output: "standalone"`, non-root,
`prisma migrate deploy` on start, healthcheck). Extend the root `docker-compose.yml`
(already has `db`) with `web` + a one-shot `seed` service against that `db`.
`.dockerignore`. Then delete `Custom_Pensum/app/`. (Vercel is the primary deploy
target now — this is for self-hosting parity.)

## Gotchas

- All `npm run *` commands run from `Custom_Pensum/web/`, not the repo root (no
  root `package.json`).
- Do NOT `npm run build` while `npm run dev` is running — it wipes `.next` and the
  dev server starts 500ing; restart dev after any build.
- `scripts/*.ts` need `web/.env` — seed/inspect call `process.loadEnvFile()` when
  `DATABASE_URL` is unset; the Next app loads `.env` itself. `.env` is gitignored;
  for local dev copy `.env.example` (its default `DATABASE_URL` points at the
  docker-compose `db` — `docker compose up -d db` first).
- MySQL, one `DATABASE_URL` — no pooled/direct split (that was Neon/PgBouncer-only,
  removed with the Postgres→MySQL swap, see Infra above).
- `prisma migrate dev` (not `db:deploy`) needs a MySQL user that can create/drop a
  shadow DB. On a fresh container this needs a one-time
  `GRANT ALL PRIVILEGES ON *.* TO 'pensum'@'%'` as root (see Infra above) —
  otherwise it fails with P3014. Not needed for plain `db:deploy` (CI/prod path).
- Old SQLite migrations live in `web/prisma/_archive_sqlite_migrations/`, old
  Postgres migration in `web/prisma/_archive_postgres_migrations/` (reference
  only — Prisma ignores both). Never re-add either to `web/prisma/migrations/`.
- Seeding now makes ~2 API calls per offered course (`/api/courses` +
  `/api/courseDetails`); still well under the abort threshold with concurrency 4 +
  the per-run cache. `SEED_SKIP_DETAILS=1` pulls offerings only.
- **A plain `npm run seed` is non-destructive** once catalogs exist: it keeps
  `CatalogCourse` rows, `Catalog.rules`/identity and `RequirementNode` rows
  (they're admin-owned) and only refreshes pairing/offerings. To re-derive from
  the Excel: `SEED_REBUILD_COURSES=1` (course rows) and/or `SEED_RESET_META=1`
  (rules + identity + requirement nodes + elective integrador flag). A truly
  fresh build = delete `web/prisma/dev.db*` then `npm run seed`.
- Legacy SQLite note (kept — schema still follows it): `Json @default("[]")` emitted
  broken DDL on SQLite, so all JSON columns are nullable `Json?` and code treats
  null as `[]`. Fine to keep on MySQL too.
- `lib/db.ts` `applySqlitePragmas()` no-ops unless `DATABASE_URL` starts with
  `file:` — dormant on MySQL, left in place for a possible SQLite fallback.
- MySQL defaults bare `String` fields to `VARCHAR(191)` (Prisma's utf8mb4
  index-length default) — long free text (names, prereq expressions,
  descriptions, error/note strings) is annotated `@db.VarChar(500)` /
  `@db.Text` in `schema.prisma`. Any *new* `String` field meant to hold more
  than ~191 chars needs the same treatment or MySQL will silently truncate it.
- The "con Precálculo" sheets have stale `SEM n` column markers (off by one vs the
  "Quinto Semestre" section headers). Parser trusts the section headers; mismatches
  become non-blocking warnings surfaced in the (future) admin validation report.
- npm here has a `allow-scripts` wrapper that blocks postinstall; `prisma generate`
  is wired into `npm run build`, run it manually after a fresh `npm install`.
- **Querying/writing the real Neon DB from this machine:** the Vercel project
  is `fg-edu-teps-projects/pensum` (not under the `fgutep` personal account —
  `vercel login`/`vercel link` need the `fg-edu-tep` account). `vercel env
  pull` only has `DATABASE_URL`/`DIRECT_URL` under the **Production**
  environment (Development has none). `schema.prisma`'s datasource is
  currently a local-only MySQL override (see the comment at the top of the
  file, "not committed") to work around a local Prisma-engine auth bug on
  Windows — to talk to Neon, temporarily flip it back to `postgresql` +
  `env("DATABASE_URL")`/`env("DIRECT_URL")`, `prisma generate`, do the work,
  then flip it back and `prisma generate` again. Neon's serverless compute
  scales to zero when idle — a "Can't reach database server" on the first
  query after a pause is normal, just retry once.
