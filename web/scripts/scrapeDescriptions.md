# Course description scraper

Populates `Course.description` (+ `descriptionUrl`, `descriptionSyncedAt`) from
the public Uniandes catalog at **uniandes.smartcatalogiq.com**.

It is a **standalone tool**, deliberately not part of `npm run seed`:
`Course.description` is admin-owned data, so a scrape (or a later hand edit)
survives re-seeding.

The admin panel exposes the same capability without the CLI: **Descripciones**
(coverage + a chunked "Sincronizar faltantes" that calls
`POST /api/admin/descriptions` 8 codes at a time), and a per-course **"Traer
descripción del catálogo"** button in the catalog editor
(`POST /api/admin/courses/<code>/description`). Both reuse
`lib/scrape/descriptionSync.ts` → `lib/import/smartcatalog.ts`. Use this CLI for a
full offline pass; the panel is for one-off top-ups.

## Run

```bash
cd web
npm run scrape:desc                       # only courses that have no description yet
SCRAPE_FORCE=1 npm run scrape:desc        # re-fetch every course
ONLY=IELE2100,MATE1203 npm run scrape:desc # just these codes
```

Env knobs:

| var | default | meaning |
|---|---|---|
| `SCRAPE_FORCE` | – | `1` = re-fetch even courses that already have a description |
| `ONLY` | – | comma-separated `normalizedCode`s to limit the run |
| `SCRAPE_CONCURRENCY` | `4` | parallel page fetches |
| `SMARTCATALOG_PROGRAM_URLS` | the 2 EE program pages | comma-separated program pages to harvest course links from (absolute or site-relative) |

## How it works (`lib/import/smartcatalog.ts`)

1. **Harvest** — fetch the program pages and pull every
   `/es-es/<year>/catalogo/cursos/<dept>/<level>/<dept>-<num>` link into a
   `Map<normalizedCode, url>`. Year and level vary per course, so the links are
   the reliable enumeration; a constructed URL (`fallbackUrls`) is only tried
   when a code wasn't linked.
2. **Fetch & parse** — every page is decoded as **Windows-1252** (the site sends
   `<meta charset="UTF-8">` but serves cp1252). `parseCoursePage` reads the
   `<h1>` (code + title) and `<div class="desc">` body, strips tags, decodes the
   Latin-1 named entities the site emits (`&iacute;`, `&ntilde;`, …), collapses
   whitespace.
3. **Write** — `Course.description` / `descriptionUrl` / `descriptionSyncedAt`.

## Coverage notes

- Brand-new courses (e.g. `IELE 1081/1082` "Taller IEE", `IELE 2150`) and
  wildcard/elective placeholder codes (`IELE 301X` → `IELE3018/3118/3218`) are
  not in the 2024/2025 catalog and come back "no description found". That's
  expected; fill those in from the admin panel when it exists.
- Placeholder slots (CBU, ELECTIVA, CLE, EFI, CI) have no `Course` row and are
  never scraped.

## UI

`catalogPayload.ts` puts `description` on each `Course`; `SidePanel` renders a
"Descripción" block (with a "Fuente: catálogo Uniandes." line) when present.
