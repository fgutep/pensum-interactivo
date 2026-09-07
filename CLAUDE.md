# Custom_Pensum

Interactive curriculum ("pensum") app for Uniandes Ingeniería Eléctrica / Electrónica.
Being re-scoped from a static Vite SPA into a Next.js full-stack app (SQLite DB,
`/administrador` panel, live pairing against the Uniandes course API).

## Where things stand

- **Current status & next steps:** [`.claude/PROGRESS.md`](.claude/PROGRESS.md)
- **Approved design / full plan:** [`.claude/PLAN.md`](.claude/PLAN.md)

Read `PROGRESS.md` first — it lists what's done (P0 data pipeline, P1 student panel),
what's next (P2 admin, P3 Docker), and the gotchas.

## Layout

- `web/` — the Next.js app (all `npm run *` commands run **here**, not the repo root)
- `app/` — the original Vite SPA, kept as migration reference until P1 is signed off, then deleted
- `PENSUMS PREGRADO (DOCUMENTO BASE)) CBU3.xlsx`, `PRERREQUISITOS TODOS 202620.xlsx` — source data the seed/import reads
- `pensum-interactivo-product-doc.md` — earlier product doc (its Python/Postgres stack is superseded; see `.claude/PLAN.md`)

## Quick start

```bash
cd web
npm install          # then: npx prisma generate  (postinstall is sandboxed here)
npm run db:deploy    # apply schema
npm run seed         # first load: DB from the two .xlsx + course API (~60s).
                     # Re-runs are non-destructive (keep admin edits) — force with
                     # SEED_REBUILD_COURSES=1 / SEED_RESET_META=1.
npm run dev          # http://localhost:3000
```

Other scripts (all in `web/`):
- `npm run scrape:desc` — course descriptions from smartcatalogiq → `Course.description` (standalone; the seed never touches it). Docs: `scripts/scrapeDescriptions.md`.
- `npm run export:templates` — regenerate `plantillas/PLANES.xlsx` + `ELECTIVAS.xlsx` (coordinator import templates) from the DB. Docs: `scripts/exportTemplates.md`.

Do **not** run `npm run build` while `npm run dev` is running — it wipes `.next` and the dev server starts 500ing.
