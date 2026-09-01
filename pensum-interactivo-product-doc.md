# Pensum Interactivo — Product & Technical Design Document

**Working name:** Pensum Interactivo (internal codename: `pensum-app`)
**Owner:** Monitor, Departamento de Ingeniería Eléctrica y Electrónica (IELE)
**Status:** Draft v1.0 — for review by IELE direction and DTIC
**Date:** August 2026

---

## 1. Summary

A small, self-contained web application that renders any academic program's *pensum* as an interactive prerequisite/corequisite graph. Students explore the curriculum visually: selecting a course reveals what it requires before it, what it requires alongside it, and — running the relation in reverse — selecting the courses already approved reveals which courses that unlocks.

Departmental staff maintain the data through an administrative interface with drag-and-drop, dropdowns and click-to-connect editing, or by uploading a standardized Excel file that is parsed, validated, diffed and applied.

The student-facing view is embedded into the existing Drupal site via iframe. The administrative interface is served from the application's own domain, outside the iframe. The whole thing ships as a single Docker image running as a single service, backed by an external managed PostgreSQL instance.

### Why this exists

The current pensum pages are static Drupal content that degrade into a PDF link. They go stale because updating them is slow and unpleasant, and they communicate nothing about the structure of the program — which is the single thing students most need when planning a semester. The authoritative data currently lives in an unstructured Excel file maintained by hand.

### What success looks like

- A student can answer "what can I take next semester?" in under 30 seconds without contacting an advisor.
- A staff member can publish a pensum correction in under 5 minutes without a ticket to DTIC.
- A second department (DISC, IMEC, etc.) can be onboarded by uploading a spreadsheet, with zero code changes.

---

## 2. Goals and non-goals

### Goals

| # | Goal |
|---|---|
| G1 | Visualize prerequisites and corequisites for any course in a program |
| G2 | Reverse lookup: given a set of approved courses, show what is now available, and what is *one course away* |
| G3 | Self-service content maintenance for non-technical staff |
| G4 | Bulk maintenance via a standardized Excel template with a safe, reversible import |
| G5 | Program-agnostic: works for any curriculum in the university |
| G6 | Embeds cleanly in the existing Drupal site without requiring Drupal changes beyond an iframe (plus, ideally, one resize snippet) |
| G7 | Single Docker image, single service, deployable to AWS by DTIC |

### Non-goals (v1)

- **Not** a registration or enrollment system. It does not talk to Banner/SIGA, does not know real student records, does not reserve seats.
- **Not** an academic-progress audit. It reflects the published pensum, not a student's official transcript.
- **Not** a schedule builder (no timetables, no conflict detection).
- **No student accounts.** Student-side state lives in the browser only.
- **Not** a replacement for the Drupal site or for official academic documents.

### Explicit disclaimer requirement

Every student-facing view must carry a persistent, visible note: this tool is informational, the official curriculum and requirements are those published by the Registro Académico, and students should confirm with their advisor. This is non-negotiable and should be agreed in writing with IELE direction before launch.

---

## 3. Users

**Student (primary, anonymous).** Undergraduate planning a semester or considering an emphasis/minor. Mobile use is common — likely a majority of sessions. Wants: what can I take, what does this course lead to, am I going to get stuck.

**Prospective student / parent.** Browsing the public program page. Wants a legible overview of the degree shape and workload.

**Department staff / academic coordinator (admin).** Non-technical. Owns the pensum data. Currently edits an Excel file. Wants: change a prerequisite, add a course, publish a new catalog year, without asking anyone for permission or help.

**Program director (approver).** Reviews and publishes catalog versions. May want a preview link before anything goes public.

**DTIC (operator).** Deploys and monitors the container. Wants: no surprises, no new attack surface, no dependency on the monitor's continued presence.

---

## 4. Product scope

### 4.1 Student experience

**Curriculum map.** The full program rendered as a layered graph: courses positioned in columns by suggested semester, edges drawn between them. Course nodes show code, name, credits, and a color/shape encoding for course type (núcleo, electiva profesional, CBU, complementaria, etc.). Default view is the complete published catalog for the current year.

**Course focus.** Clicking a course dims the rest of the graph and highlights:
- direct prerequisites (upstream, one hop)
- the full transitive prerequisite chain (upstream, all hops) — toggleable
- corequisites (rendered distinctly, e.g. dashed/lateral edges, since they are not directional in time)
- direct dependents (downstream, one hop) and the full transitive impact set

A side panel shows the course detail: description, credits, requirement expression in readable form ("Requiere MATE1105 **y** FISI1018, **o** MATE1214"), and the count of courses that depend on it.

**Progress mode ("ya vi estas materias").** The student marks approved courses by clicking, or by lasso/multi-select. The graph then classifies every remaining course:
- **Available now** — all prerequisites satisfied
- **One course away** — exactly one unmet requirement, with that course named
- **Blocked** — two or more unmet requirements, with the shortest unlocking path shown on hover
- **Approved** — selected

A summary bar shows credits approved / total, and a "critical path" indicator: the longest remaining prerequisite chain, i.e. the minimum number of semesters left if nothing else constrained the student. This is the single most useful number in the app and it falls out of the graph for free.

**Sharing and persistence.** Selection state persists in `localStorage` and is encodable into the URL hash so a student can send their state to an advisor or a friend. No account, no server-side storage, no personal data.

**Search and filter.** Search by code or name. Filter by course type, by semester, by credit count. "Show only what I can take next."

**Language.** Interface strings in Spanish and English, following the university's bilingual site convention. Course names come from the data and may exist in both languages if the source provides them.

**Accessibility.** The graph is a visual affordance, not the only affordance. A parallel accessible mode presents the same information as a semantic table/list with keyboard navigation and screen-reader labels. Color is never the sole carrier of meaning (state is also indicated by icon and text label). Target WCAG 2.1 AA.

**Mobile.** Below a breakpoint, the graph switches from free pan/zoom to a vertical semester-by-semester accordion with the same focus/highlight logic. Do not ship a pinch-to-zoom SVG as the only mobile experience; it fails.

### 4.2 Admin experience

**Authentication.** OIDC against the university identity provider if DTIC will issue a client; local accounts with argon2id hashing as the fallback. Two roles: `editor` (edit drafts) and `publisher` (publish catalogs, manage users).

**Catalog management.** A *catalog* is a versioned snapshot of a program's curriculum (e.g. "IELE 2024-2"). Catalogs are `draft`, `published` or `archived`. Editors work on drafts; publishing makes a draft the live catalog for that program and archives the previous one. Drafts have a shareable preview URL.

**Graph editor.** The same React Flow canvas as the student view, in edit mode:
- drag a node to change its suggested semester (column) and vertical position
- drag from a node's handle to another node to create a requirement edge
- click an edge to set its type (prereq / coreq / equivalent) or delete it
- double-click a node to open the course form
- multi-select and bulk-edit semester or course type

**Course form.** Code, name (ES/EN), credits, type, description, active flag, external link. Validation on code uniqueness within the institution.

**Requirement builder.** For complex requirements the canvas can't express, a structured editor: add a requirement group, choose logic (`ALL` / `ANY_N` / `CREDITS`), and add items (specific courses, or a named course pool). Renders a live preview of the human-readable expression.

**Course pools.** Named sets of interchangeable courses ("Electivas de Potencia", "CBU tipo E"), referenced by requirement groups and by the catalog itself for elective slots.

**Validation on save.** The editor refuses to publish (and warns while editing) on:
- a cycle in the prerequisite graph (corequisite edges excluded from the check)
- a prerequisite whose suggested semester is ≥ the dependent's
- a course referenced by a requirement but absent from the catalog
- an orphan course with no path to or from anything, flagged as a warning not an error
- a course pool with fewer members than a requirement's `min_count`

**Excel import.** See §7 — this is a subsystem, not a button.

**Excel export.** Any catalog can be exported to the same template format. This makes the round-trip real: export, edit in Excel where staff are comfortable, re-import with a diff.

**Audit log.** Every mutation records actor, timestamp, entity, before/after. Visible in the admin UI, filterable. Necessary because the data is institutionally authoritative and someone will eventually ask "who changed this and when."

**Snapshots and rollback.** Every publish and every applied import writes a full JSON snapshot of the catalog. One-click restore to any snapshot.

---

## 5. Architecture

### 5.1 Shape

```
                    ┌──────────────────────────────────┐
  Student  ────────▶│  Drupal page (uniandes.edu.co)   │
                    │   <iframe src="pensum.../embed"> │
                    └───────────────┬──────────────────┘
                                    │  HTTPS
                                    ▼
                    ┌──────────────────────────────────┐
                    │  ALB (ACM cert)                  │
                    └───────────────┬──────────────────┘
                                    ▼
  Admin ───────────▶┌──────────────────────────────────┐
  (direct, no       │  ECS Fargate — ONE task          │
   iframe)          │  ┌────────────────────────────┐  │
                    │  │ FastAPI (uvicorn)          │  │
                    │  │  /api/*   JSON API         │  │
                    │  │  /admin/* SPA (admin)      │  │
                    │  │  /embed/* SPA (student)    │  │
                    │  │  static/  built React bundle│ │
                    │  └────────────────────────────┘  │
                    └───────────────┬──────────────────┘
                                    │
                                    ▼
                    ┌──────────────────────────────────┐
                    │  RDS PostgreSQL (external)       │
                    └──────────────────────────────────┘
```

One image. One process. One service. External database, as approved.

### 5.2 Stack

| Layer | Choice | Rationale |
|---|---|---|
| Runtime | Python 3.12 | Excel handling and validation ergonomics |
| Web framework | FastAPI + uvicorn | Async, OpenAPI schema for free, serves static files in the same process |
| ORM / migrations | SQLAlchemy 2.x + Alembic | Migrations run at container start, before uvicorn binds |
| Validation | Pydantic v2 | Same models validate API payloads and Excel rows |
| Excel | openpyxl | Reads and writes `.xlsx`, no pandas dependency needed for this size |
| DB | PostgreSQL 16 (RDS) | Relational integrity for the requirement model; recursive CTEs available if graph work moves server-side |
| Frontend | React 18 + TypeScript + Vite | Standard, fast build, good iframe story |
| Graph | React Flow (XY Flow) + elkjs | Same component read-only and editable; elkjs computes layered layout |
| UI | Tailwind + shadcn/ui | Fast to build an admin that doesn't look like a prototype |
| Tables | TanStack Table | Course list, import diff, audit log |
| State | Zustand + TanStack Query | Client graph state; server cache |
| Auth | Authlib (OIDC) or argon2-cffi (local) | Behind a single interface, swappable |
| Packaging | `uv` | Matches existing tooling; fast, reproducible installs |

**Alternative considered — Spring Boot + Angular.** Viable, and closer to existing familiarity. Rejected for v1 because Apache POI is materially more work than openpyxl for the import/export subsystem, and the JVM image is roughly five times larger for a service this small. Worth revisiting only if the university standardizes on JVM deployments.

**Alternative considered — Cytoscape.js instead of React Flow.** Cytoscape has better built-in graph algorithms and handles very large graphs better. Rejected because a pensum is ~60–90 nodes, and React Flow's editing affordances (drag handles, edge creation, custom React nodes) are exactly the admin requirement. Graph algorithms here are ~50 lines of TypeScript.

### 5.3 Where the graph logic runs

Prerequisite evaluation runs **client-side**. The full catalog is a single JSON payload of a few dozen kilobytes. Once loaded, every interaction — focus, highlight, availability computation, critical path — is a local computation over an in-memory adjacency structure. No round-trips, works offline after first load, and no server load from student traffic.

The server is responsible for storage, validation, import/export and authorization only.

### 5.4 Docker

Multi-stage build:

```dockerfile
# Stage 1 — build the SPA
FROM node:20-alpine AS web
WORKDIR /web
COPY web/package*.json ./
RUN npm ci
COPY web/ ./
RUN npm run build          # -> /web/dist

# Stage 2 — runtime
FROM python:3.12-slim
WORKDIR /app
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev
COPY api/ ./api/
COPY --from=web /web/dist ./static/
ENV PORT=8000
EXPOSE 8000
CMD ["sh", "-c", "uv run alembic upgrade head && uv run uvicorn api.main:app --host 0.0.0.0 --port $PORT"]
```

Non-root user, healthcheck on `/api/health`, image target under 250 MB.

### 5.5 Configuration

All configuration by environment variable, no config files in the image:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string (from Secrets Manager) |
| `FRAME_ANCESTORS` | Space-separated list of allowed embedding origins |
| `SESSION_SECRET` | Cookie signing key |
| `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET` | Optional; enables SSO when present |
| `ADMIN_BOOTSTRAP_EMAIL` | Seeds the first publisher account on empty DB |
| `PUBLIC_BASE_URL` | For generating absolute preview/share links |
| `LOG_LEVEL` | |

---

## 6. Data model

The central design decision. A flat edge table cannot represent real academic requirements, which are boolean expressions over courses plus credit thresholds. The model below separates **courses** (global, reusable) from **catalogs** (a program's curriculum in a given year) from **requirements** (grouped, with logic).

```
institution
  id, name, code

program
  id, institution_id, code, name_es, name_en, faculty, degree_level

catalog                                    -- a versioned pensum
  id, program_id, label ("2024-2"), status (draft|published|archived),
  effective_from, published_at, published_by, notes

course                                     -- global course registry
  id, institution_id, code UNIQUE(institution, code),
  name_es, name_en, credits, description, is_active

catalog_course                             -- a course's role in one catalog
  id, catalog_id, course_id,
  suggested_semester (int, nullable),
  course_type (nucleo|electiva|cbu|complementaria|proyecto|...),
  is_required (bool),
  position_x, position_y (nullable, manual layout override)
  UNIQUE(catalog_id, course_id)

course_pool                                -- "Electivas de Potencia"
  id, catalog_id, name, description, min_credits

course_pool_member
  pool_id, course_id

requirement                                -- a group attached to a catalog_course
  id, catalog_course_id,
  type (prereq|coreq|equivalent),
  logic (ALL|ANY_N|CREDITS),
  min_count (int, for ANY_N),
  min_credits (int, for CREDITS),
  label (optional human note)

requirement_item                           -- a member of a group
  id, requirement_id,
  target_course_id (nullable),
  target_pool_id (nullable)
  CHECK (exactly one of the two is non-null)

catalog_snapshot                           -- rollback + audit
  id, catalog_id, payload (jsonb), created_at, created_by, reason

import_job
  id, catalog_id, filename, uploaded_by, uploaded_at,
  status (parsed|failed|applied|discarded),
  diff (jsonb), errors (jsonb), applied_at

app_user
  id, email, name, role (editor|publisher), password_hash (nullable),
  oidc_subject (nullable), is_active, last_login

audit_log
  id, actor_id, action, entity_type, entity_id, before (jsonb),
  after (jsonb), created_at
```

### Requirement semantics

A `catalog_course` may have multiple `requirement` rows. **All requirement groups on a course must be satisfied** (they are ANDed together); within a group, `logic` determines how the items combine. This gives full expressiveness for realistic cases:

- `MATE1105 AND FISI1018` → one group, `ALL`, two items.
- `MATE1105 OR MATE1214` → one group, `ANY_N` with `min_count=1`, two items.
- `(A AND B) OR C` → two groups won't express this directly. Model it as `ANY_N(min_count=1)` over items where one item points to a pool `{C}` and… **no.** For genuine nested boolean expressions, add a nullable `parent_requirement_id` to `requirement`, allowing groups to nest one level. Recommend implementing the nesting column from day one even if the UI only exposes two levels; retrofitting it later is painful.
- `≥ 90 credits approved` → one group, `CREDITS`, `min_credits=90`, zero items (meaning: any approved credits) or items restricted to a pool.
- Corequisite → a group with `type=coreq`; evaluated as "taken before **or** simultaneously," and excluded from cycle detection.
- Equivalence → `type=equivalent`; the target course substitutes for this one when evaluating other requirements.

### Why courses are global

Because MATE1105 is the same course in IELE, DISC and IMEC. A global registry means: onboarding a second program only requires new `catalog_course` and `requirement` rows; cross-program equivalences become possible later; and course name corrections propagate. The cost is a slightly more careful import (codes must resolve or be created explicitly).

---

## 7. Excel import subsystem

The single most important feature for adoption, and the most dangerous. Design principle: **the import never applies directly.** It parses, validates, produces a diff, and waits for a human.

### 7.1 Template

A generated `.xlsx` with four sheets and a locked header row.

**Sheet `Cursos`**

| Column | Required | Notes |
|---|---|---|
| `codigo` | yes | e.g. `IELE2330`. Primary key for matching. |
| `nombre_es` | yes | |
| `nombre_en` | no | |
| `creditos` | yes | integer |
| `semestre_sugerido` | no | integer; blank = unplaced |
| `tipo` | yes | one of the values in `Referencia` |
| `obligatoria` | yes | `SI` / `NO` |
| `descripcion` | no | |
| `requisitos` | no | expression, see below |
| `correquisitos` | no | expression |

**Sheet `Agrupaciones`** — course pools.

| Column | Notes |
|---|---|
| `pool` | pool name, repeated per member row |
| `codigo` | member course code |
| `creditos_minimos` | optional, on the first row of each pool |

**Sheet `Referencia`** — read-only: allowed `tipo` values, expression syntax reference, examples. This sheet is what makes the template self-teaching.

**Sheet `_meta`** — hidden: template version, program code, catalog label, export timestamp. Used to reject mismatched or outdated templates with a clear message.

### 7.2 Requirement expression syntax

One row per course, not one row per edge — staff will maintain the former and abandon the latter.

```
IELE2330               single prerequisite
A + B                  both required            (AND)
A | B                  either one               (OR)
(A + B) | C            grouping
2 of [A, B, C]         any two of three
90 cr                  90 credits approved
30 cr of {Pool Name}   30 credits from a pool
{Electivas de Potencia}  one course from a pool
```

Parsed by a small recursive-descent parser (~150 lines) into the `requirement` / `requirement_item` structure. Parse errors are reported per cell with row, column, character offset and the offending token.

### 7.3 Pipeline

1. **Upload** — `.xlsx` only, ≤ 5 MB, admin authenticated.
2. **Parse** — openpyxl reads sheets into Pydantic models. Template version checked against `_meta`.
3. **Validate** — three tiers:
   - *Errors* (block application): unparseable expression, unknown `tipo`, non-integer credits, duplicate code, reference to a course not present in the file and not in the global registry, requirement cycle.
   - *Warnings* (allow, but surface): course dropped relative to current catalog, prerequisite in a later semester than its dependent, orphan course, unusual credit value.
   - *Info*: counts of added/changed/unchanged.
4. **Diff** — compare parsed result against the current draft. Render a review screen: courses added / removed / modified (field-level before→after), requirements added / removed / changed, pools changed. Nothing is written yet; the parsed payload lives in `import_job.diff`.
5. **Confirm** — admin reviews and clicks apply. A `catalog_snapshot` is written first, then the changes are applied in a single transaction, then `import_job.status = applied`.
6. **Rollback** — one click restores the pre-import snapshot.

### 7.4 Export

Any catalog exports to the identical template, `_meta` populated. This is what makes the workflow trustworthy: staff export the current truth, edit it in the tool they already know, and re-import with a visible diff.

### 7.5 Migrating the current spreadsheet

The existing IELE file is unstructured. The migration is a one-time, manual-assisted job: write a throwaway script that maps its columns into the template, run it, then have a coordinator review the output template by hand before the first import. Budget real time for this — **it is the highest-risk item in the project**, because it is the step where the data's true messiness becomes visible, and it may reveal requirement patterns the model doesn't yet handle. Do it first, before building the UI.

---

## 8. API

Public, unauthenticated, read-only:

```
GET  /api/health
GET  /api/programs                         list programs with published catalogs
GET  /api/programs/{code}/catalog          current published catalog, full graph
GET  /api/catalogs/{id}                    specific catalog (published only)
GET  /api/catalogs/{id}/preview?token=     draft preview, signed token
```

The catalog payload is a single denormalized JSON document: courses, positions, pools, and requirements as nested groups. Cached with `ETag` and `Cache-Control: public, max-age=300`. This endpoint is deliberately public — it costs nothing and lets other departments, the Drupal site, or a future mobile app consume the data. It is also the strongest argument for institutional adoption.

Authenticated, admin:

```
POST   /api/auth/login | /api/auth/oidc/callback | /api/auth/logout
GET    /api/admin/catalogs
POST   /api/admin/catalogs                       create draft (optionally cloned)
PATCH  /api/admin/catalogs/{id}
POST   /api/admin/catalogs/{id}/publish
POST   /api/admin/catalogs/{id}/snapshots
POST   /api/admin/catalogs/{id}/restore/{snapshot_id}
GET    /api/admin/catalogs/{id}/export.xlsx
POST   /api/admin/catalogs/{id}/imports         upload -> parse -> diff
GET    /api/admin/imports/{job_id}
POST   /api/admin/imports/{job_id}/apply
DELETE /api/admin/imports/{job_id}
CRUD   /api/admin/courses, /catalog-courses, /requirements, /pools
GET    /api/admin/audit
CRUD   /api/admin/users                          publisher only
```

---

## 9. Embedding in Drupal

The integration constraint is that no non-Drupal application may run alongside Drupal; the agreed pattern is an iframe pointing at a separately hosted service.

**Headers.** Send `Content-Security-Policy: frame-ancestors https://<drupal-host>` and **do not send** `X-Frame-Options` — `ALLOW-FROM` is ignored by every current browser and its presence can break the embed. `FRAME_ANCESTORS` is configurable per environment.

**Admin stays out of the iframe.** `/admin` is reached directly at the application's own domain. This avoids `SameSite=None; Secure` session cookies and third-party cookie blocking entirely — a whole category of failure removed for free. Session cookies are `SameSite=Lax; Secure; HttpOnly`.

**Height.** Iframes do not auto-size. Two options:
1. *Preferred:* the embedded app posts its content height to the parent on change; a ~10-line script in the Drupal template listens and resizes. Requires DTIC to add the snippet.
2. *Fallback:* fixed height (e.g. `80vh`) with internal scrolling and pan/zoom. Works without any Drupal change, but is a worse experience.

**Negotiate option 1 now**, while DTIC is engaged. Retrofitting it later means a new ticket.

**HTTPS is mandatory** — a Drupal page on HTTPS will block an HTTP iframe as mixed content. ALB with an ACM certificate.

**Deep links.** An iframe cannot change the parent URL. Internal state lives in the iframe's own hash. If a shareable parent URL is wanted, the app posts the state to the parent, which updates its own query string — treat this as a nice-to-have, not a launch requirement.

**Analytics.** If the parent page runs the university's analytics, the iframe will not be counted. Either accept that, or emit a `postMessage` event on load that the parent forwards. Keep it anonymous.

---

## 10. Deployment and operations

**Environment.** ECS Fargate, one service, desired count 1 (2 for zero-downtime deploys if DTIC prefers; the app is stateless so both are fine). ALB in front with ACM certificate. Image in ECR. RDS PostgreSQL, `db.t4g.micro` is generously sized for this workload. Secrets in AWS Secrets Manager, injected as environment variables.

**Sizing.** 0.25 vCPU / 512 MB is sufficient. The catalog payload is cached and the compute happens in the browser.

**Migrations** run at container start via `alembic upgrade head` before uvicorn binds. Migrations must be backward-compatible so a rolling deploy can't break the previous task.

**CI/CD.** GitHub Actions: lint → typecheck → tests → build image → push to ECR → update ECS service. Two environments: `staging` and `prod`, distinguished only by environment variables.

**Backups.** RDS automated backups, 7-day retention minimum. In addition, a weekly job exports every published catalog to `.xlsx` and writes it to S3 — a human-readable disaster recovery artifact that doesn't depend on the application existing.

**Monitoring.** CloudWatch: container health, ALB 5xx rate, RDS connections. Structured JSON logs. Alarm on sustained 5xx and on failed health checks. This is a low-traffic internal tool; do not over-instrument it.

**Continuity.** This is a monitor-built project and monitors graduate. Mitigations, in order of importance: (1) the public JSON API and the Excel export mean the data is never trapped; (2) the README must contain a complete local-setup and deploy runbook; (3) the repository lives in a department- or university-owned organization, not a personal account, from the first commit.

---

## 11. Security and privacy

- **No student personal data is collected or stored.** Progress state is `localStorage` only. This keeps the project outside the scope of Ley 1581 de 2012 (habeas data) obligations and removes the need for a data-protection review. Preserve this property deliberately — the first feature request for "save my progress to my account" should be weighed against losing it.
- Admin authentication via institutional OIDC where available; otherwise argon2id password hashing, rate-limited login, and a forced change of the bootstrap credential.
- Authorization enforced server-side on every admin endpoint. Role checks in the UI are cosmetic only.
- Uploads restricted to `.xlsx`, size-capped, parsed with `openpyxl` in read-only mode. No macro execution, no formula evaluation. Filenames are never used as paths.
- All queries via SQLAlchemy parameterization. No string-built SQL.
- Rate limiting on public endpoints (they are cached and cheap, but the limit protects the DB).
- Dependency scanning in CI; monthly base-image rebuild.
- Audit log for every mutation.

---

## 12. Roadmap

**Phase 0 — Data reality check (1–2 weeks).** Define the schema. Write the parser and importer. Migrate the real IELE spreadsheet into the template and import it. *Deliverable: a validated JSON graph of the actual IELE pensum.* No UI. This phase de-risks the entire project; if the data cannot be structured, everything else is moot.

**Phase 1 — Read-only student view (2–3 weeks).** React Flow graph, focus/highlight, course detail panel, mobile layout, Spanish/English, accessible table mode. Deployed and embedded in a staging Drupal page. *This alone is already better than the current PDF and is worth shipping on its own.*

**Phase 2 — Progress mode (1 week).** Approved-course selection, availability classification, one-course-away, critical path, `localStorage` and URL-hash sharing.

**Phase 3 — Admin (3–4 weeks).** Auth, catalog CRUD, graph editor, requirement builder, validation, audit log, snapshots, import diff UI, export.

**Phase 4 — Institutional (2 weeks).** Multi-program onboarding, catalog versioning and publish workflow, OIDC, public API documentation, onboarding guide for other departments.

**Later, if warranted.** Emphasis/minor overlays. "What if" planning across future semesters. Course-load balancing suggestions. Comparison between catalog years for students on an older pensum. Integration with real academic records — a large step, requiring a data-protection review, and out of scope here.

---

## 13. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Source spreadsheet is messier than expected; requirements don't fit the model | High | Phase 0 exists precisely for this. Nested requirement groups from day one. |
| DTIC declines the iframe resize snippet | Medium | Fixed-height fallback designed in from the start |
| The tool is treated as authoritative and a student mis-plans | High | Persistent disclaimer, written agreement with IELE direction, link to official Registro Académico page on every view |
| Staff never adopt the admin UI and revert to email requests | High | Excel round-trip is the adoption bridge — meet them where they are; run a training session; watch the audit log for actual usage |
| Project stalls when the monitor leaves | High | University-owned repo, runbook, public API, Excel export |
| Scope creep toward enrollment/registration | Medium | Non-goals are stated in §2 and should be restated in every review meeting |
| Drupal 11 migration changes the embedding page | Medium | The iframe contract is version-independent; confirm `frame-ancestors` origin with the contractor |

---

## 14. Open questions for DTIC and IELE

1. Will DTIC provision RDS, or must the DB be self-managed? *(Assumed approved: external managed Postgres.)*
2. Can an OIDC client be issued against the university IdP for the admin panel?
3. Will DTIC add the ~10-line iframe resize snippet to the Drupal template?
4. What hostname will the app receive, and who manages the certificate?
5. Who is the designated data owner for the IELE pensum, and who has publish authority?
6. Is there an existing authoritative machine-readable curriculum source (Banner/SIGA export) that would beat the spreadsheet as a data origin?
7. Does the university have a component library or brand guideline the embedded view must follow?
8. Who maintains this after the current monitor's contract ends?

---

## Appendix A — Availability evaluation

```
approved: Set<CourseId>
approvedCredits: number

satisfied(group, approved):
  switch group.logic:
    ALL:     every item satisfied
    ANY_N:   count(satisfied items) >= group.min_count
    CREDITS: creditsFrom(approved, group.scope) >= group.min_credits
  (nested groups recurse)

itemSatisfied(item, approved):
  if item.target_course_id: course in approved OR an equivalent in approved
  if item.target_pool_id:   any pool member in approved

available(course, approved):
  all groups of type prereq satisfied
  AND all groups of type coreq satisfiable in the same semester
       (i.e. the coreq target is approved, or is itself available now)

distanceToUnlock(course, approved):
  minimum number of additional courses that, if added to `approved`,
  would make `course` available — computed by BFS over unmet items,
  capped at depth 3 for display

criticalPath(approved):
  longest path in the DAG restricted to unapproved required courses
  = minimum remaining semesters under prerequisite constraints alone
```

## Appendix B — Repository layout

```
pensum-app/
├── api/
│   ├── main.py                 app factory, static mount, CSP middleware
│   ├── config.py               env-var settings
│   ├── db.py                   engine, session
│   ├── models/                 SQLAlchemy
│   ├── schemas/                Pydantic
│   ├── routers/                public/, admin/, auth/
│   ├── services/
│   │   ├── graph.py            cycle detection, topological validation
│   │   ├── requirements.py     expression parser + renderer
│   │   ├── importer.py         parse -> validate -> diff -> apply
│   │   └── exporter.py         catalog -> xlsx
│   └── migrations/             Alembic
├── web/
│   ├── src/
│   │   ├── embed/              student SPA
│   │   ├── admin/              admin SPA
│   │   ├── graph/              shared React Flow components
│   │   ├── lib/                availability engine (pure TS, unit-tested)
│   │   └── i18n/               es.json, en.json
│   └── vite.config.ts
├── templates/
│   └── pensum-template-v1.xlsx
├── tests/
├── Dockerfile
├── pyproject.toml
└── README.md                   local setup + deploy runbook
```
