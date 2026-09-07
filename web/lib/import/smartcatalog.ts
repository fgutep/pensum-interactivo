// Scraper for course catalog descriptions from uniandes.smartcatalogiq.com.
// Pure of the DB and of Node globals beyond fetch/TextDecoder — the runner is
// scripts/scrapeDescriptions.ts.
//
// The site declares <meta charset="UTF-8"> but is actually served as
// Windows-1252, so every page is decoded with TextDecoder("windows-1252").
// Course pages live at:
//   /es-es/<year>/catalogo/cursos/<dept>/<level>/<dept>-<number>
// with <year> and <level> varying per course, so the reliable enumeration is to
// scrape the program pages for their <a href> course links; a constructed URL is
// only a fallback.

export const SMARTCATALOG_BASE = "https://uniandes.smartcatalogiq.com";

/** Program pages whose course links we harvest. Override with
 *  SMARTCATALOG_PROGRAM_URLS (comma-separated, absolute or site-relative). */
export const DEFAULT_PROGRAM_PATHS = [
  "/es-es/2026/catalogo/facultad-de-ingenieria/electrical-and-electronic-engineering-department/undergraduate/electrical-engineering-degree",
  "/es-es/2026/catalogo/facultad-de-ingenieria/electrical-and-electronic-engineering-department/undergraduate/electronic-engineering-degree",
];

export interface FetchTextOpts {
  timeoutMs?: number;
  retries?: number;
  userAgent?: string;
}

export interface FetchTextResult {
  status: number;
  html: string;
  url: string;
}

const UA =
  "Mozilla/5.0 (compatible; PensumInteractivo/1.0; +catalog description sync)";

export function abs(url: string): string {
  return url.startsWith("http") ? url : `${SMARTCATALOG_BASE}${url}`;
}

/** GET a page, decoded as Windows-1252. Never throws — returns status 0 on error. */
export async function fetchText(
  url: string,
  opts: FetchTextOpts = {}
): Promise<FetchTextResult> {
  const { timeoutMs = 10000, retries = 1, userAgent = UA } = opts;
  const target = abs(url);
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(target, {
        signal: ctrl.signal,
        headers: { "User-Agent": userAgent, Accept: "text/html" },
      });
      const buf = await res.arrayBuffer();
      const html = new TextDecoder("windows-1252").decode(buf);
      return { status: res.status, html, url: target };
    } catch (err) {
      lastErr = err;
      if (attempt < retries) await new Promise((r) => setTimeout(r, 600));
    } finally {
      clearTimeout(timer);
    }
  }
  return { status: 0, html: String(lastErr ?? "fetch failed"), url: target };
}

const COURSE_LINK_RE =
  /\/(?:es-es|en)\/\d{4}\/catalogo\/cursos\/[a-z0-9-]+\/[a-z0-9-]+\/([a-z]+)-([a-z0-9]+)/gi;

/** All course-page links on a program page → Map<normalizedCode, absolute URL>. */
export function harvestCourseLinks(html: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of html.matchAll(COURSE_LINK_RE)) {
    const path = m[0];
    if (/\/en\//.test(path)) continue; // keep the Spanish catalog
    const code = `${m[1]}${m[2]}`.toUpperCase();
    if (!out.has(code)) out.set(code, abs(path));
  }
  return out;
}

/** Candidate URLs for a code when it wasn't linked from a program page. */
export function fallbackUrls(
  normalizedCode: string,
  years: number[] = [2025, 2024]
): string[] {
  const m = normalizedCode.match(/^([A-Z]+)\s*([0-9]+[A-Z]?)$/);
  if (!m) return [];
  const dept = m[1].toLowerCase();
  const num = m[2].toLowerCase();
  const n = parseInt(num, 10);
  const level = Number.isFinite(n) ? Math.floor(n / 1000) * 1000 : 1000;
  return years.map(
    (y) => `${SMARTCATALOG_BASE}/es-es/${y}/catalogo/cursos/${dept}/${level}/${dept}-${num}`
  );
}

function stripTags(s: string): string {
  return s
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(p|div|li|h\d)>/gi, " ")
    .replace(/<[^>]+>/g, "");
}

// Named entities smartcatalogiq actually emits (Latin-1 + common punctuation).
const NAMED_ENTITIES: Record<string, string> = {
  nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'",
  aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú",
  Aacute: "Á", Eacute: "É", Iacute: "Í", Oacute: "Ó", Uacute: "Ú",
  ntilde: "ñ", Ntilde: "Ñ", uuml: "ü", Uuml: "Ü", agrave: "à", egrave: "è",
  iquest: "¿", iexcl: "¡", ordm: "º", ordf: "ª", deg: "°", middot: "·",
  hellip: "…", ndash: "–", mdash: "—", laquo: "«", raquo: "»",
  lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”",
  sup2: "²", sup3: "³", frac12: "½", times: "×", euro: "€",
};

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&([a-z][a-z0-9]*);/gi, (m, name) =>
      Object.prototype.hasOwnProperty.call(NAMED_ENTITIES, name)
        ? NAMED_ENTITIES[name]
        : m
    );
}

export interface ParsedCoursePage {
  code: string | null;
  title: string | null;
  description: string | null;
}

/** Pull the <h1> code/title and the <div class="desc"> body from a course page. */
export function parseCoursePage(html: string): ParsedCoursePage {
  let code: string | null = null;
  let title: string | null = null;
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1) {
    const text = decodeEntities(stripTags(h1[1])).replace(/\s+/g, " ").trim();
    const cm = text.match(/^([A-Z]{2,6}\s?-?\s?\d+[A-Z]?)\s+(.*)$/);
    if (cm) {
      code = cm[1].replace(/[\s-]/g, "").toUpperCase();
      title = cm[2].trim();
    } else {
      title = text || null;
    }
  }

  let description: string | null = null;
  const desc = html.match(/<div class="desc">([\s\S]*?)<\/div>/i);
  if (desc) {
    const text = decodeEntities(stripTags(desc[1])).replace(/\s+/g, " ").trim();
    description = text.length >= 15 ? text : null;
  }

  return { code, title, description };
}
