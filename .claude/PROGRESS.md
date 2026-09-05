# Pensum re-scope — progress log

Re-scope of `Custom_Pensum` from a build-time Vite React SPA into a Next.js full-stack
app: student panel + `/administrador` admin + SQLite DB + live pairing against the
Uniandes course API. Full approved design: [`.claude/PLAN.md`](./PLAN.md).

**Key decisions:** Next.js App Router (one container), SQLite-on-volume via Prisma,
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

### Deferred
- Seed-time `Elective.code` resolution (the on-demand route covers the student
  flow; a batch pass would let the picker show offering dots without a click).
- Admin editing of catalog identity + elective bag + progression rules
  (`Catalog.rules`) — all fold into P2, which now has three JSON columns to edit.

## Next

**P2 — admin `/administrador`.** `lib/auth/` (password provider + signed cookie),
`middleware.ts` gating `/administrador/*` + `/api/admin/*`. Screens: login, catalog
list, upload (pensum xlsx + optional prereq xlsx) → validation report → per-catalog
diff → apply/discard, manual-pairing queue (Excel-prefilled rows + live API search
widget to bind a real code / keep-as-placeholder), re-sync offerings, snapshot list +
rollback. `lib/import/apply.ts` = snapshot + `persistCatalog` + import-job status in
one txn. `lib/import/diff.ts`. Every mutation writes `AuditLog`.

**P3 — Docker.** Multi-stage `web/Dockerfile` (`output: "standalone"`, non-root,
`VOLUME /data`, `prisma migrate deploy` on start, healthcheck). Root
`docker-compose.yml` (web + one-shot `seed` service, named volume). `.dockerignore`.
Then delete `Custom_Pensum/app/`.

## Gotchas

- All `npm run *` commands run from `Custom_Pensum/web/`, not the repo root (no
  root `package.json`).
- Do NOT `npm run build` while `npm run dev` is running — it wipes `.next` and the
  dev server starts 500ing; restart dev after any build.
- `scripts/*.ts` need `web/.env` — seed/inspect call `process.loadEnvFile()` when
  `DATABASE_URL` is unset; the Next app loads `.env` itself.
- `PRAGMA` statements return rows in Prisma+SQLite → use `$queryRawUnsafe`, not
  `$executeRawUnsafe` (`lib/db.ts` `applySqlitePragmas`).
- The "con Precálculo" sheets have stale `SEM n` column markers (off by one vs the
  "Quinto Semestre" section headers). Parser trusts the section headers; mismatches
  become non-blocking warnings surfaced in the (future) admin validation report.
- npm here has a `allow-scripts` wrapper that blocks postinstall; `prisma generate`
  is wired into `npm run build`, run it manually after a fresh `npm install`.
