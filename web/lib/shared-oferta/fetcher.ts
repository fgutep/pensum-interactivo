// Focused re-implementation of Mi-Horario-Uniandes/src/services/fetcher.ts for
// this app's needs: we only pair pensum courses to the live offering, we don't
// build timetables, so we skip the Curso/Seccion/BloqueTiempo model tree and
// return raw API rows grouped by course code.

import type { SeccionAPI } from "./ofertaDeCursosAPI";

const API_BASE =
  process.env.UNIANDES_API_URL ??
  "https://ofertadecursos.uniandes.edu.co/api/courses";

// URL builders — same query-param shape Mi-Horario uses (every param present, most blank).
export function urlByCourse(code: string, term = ""): string {
  return `${API_BASE}?term=${encodeURIComponent(term)}&ptrm=&prefix=&attr=&nameInput=${encodeURIComponent(
    code.toUpperCase()
  )}`;
}

export function urlByPrefix(prefix: string, term = ""): string {
  return `${API_BASE}?term=${encodeURIComponent(term)}&ptrm=&prefix=${encodeURIComponent(
    prefix.toUpperCase()
  )}&attr=&nameInput=`;
}

export function urlByAttrAndProgram(attr: string, prefix: string, term = ""): string {
  return `${API_BASE}?term=${encodeURIComponent(
    term
  )}&ptrm=&prefix=${encodeURIComponent(prefix.toUpperCase())}&attr=&nameInput=&campus=&attrs=${encodeURIComponent(
    attr.toUpperCase()
  )}&timeStart=&offset=0&limit=100`;
}

// Special attribute / program codes, copied from Mi-Horario's fetcher.ts.
export const atributosEspeciales = ["EPSI", "INGL", "ECUR", "BLEND", "SEMP", "VIRT"];
export const programasEspeciales = ["CBCC", "CBUH", "CBUT", "DEPO"];

export interface FetchOpts {
  timeoutMs?: number;
  retries?: number;
  signal?: AbortSignal;
}

/** GET a courses URL and return the raw section array. Throws on HTTP error / timeout. */
export async function fetchSections(url: string, opts: FetchOpts = {}): Promise<SeccionAPI[]> {
  const { timeoutMs = 8000, retries = 1 } = opts;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const onAbort = () => ctrl.abort();
    opts.signal?.addEventListener("abort", onAbort, { once: true });
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      const data = (await res.json()) as SeccionAPI[];
      return Array.isArray(data) ? data : [];
    } catch (err) {
      lastErr = err;
      if (attempt < retries) await new Promise((r) => setTimeout(r, 500));
    } finally {
      clearTimeout(timer);
      opts.signal?.removeEventListener("abort", onAbort);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

/** normalize an API row's course code to the pensum key: class + course, e.g. "IELE2100". */
export function sectionCode(s: SeccionAPI): string {
  return `${String(s.class ?? "").toUpperCase()}${String(s.course ?? "").toUpperCase()}`;
}

/** group raw rows by sectionCode(). */
export function groupByCode(sections: SeccionAPI[]): Map<string, SeccionAPI[]> {
  const map = new Map<string, SeccionAPI[]>();
  for (const s of sections) {
    const k = sectionCode(s);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(s);
  }
  return map;
}
