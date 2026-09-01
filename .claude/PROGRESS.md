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
