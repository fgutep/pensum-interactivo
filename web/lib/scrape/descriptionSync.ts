// Server-side wrapper around lib/import/smartcatalog.ts for the admin panel.
// Single-course fetch (per-course "traer descripción" button) + a small batched
// pass (the Descripciones page drives it in chunks so no request runs long).

import { prisma } from "../db";
import {
  DEFAULT_PROGRAM_PATHS,
  fallbackUrls,
  fetchText,
  harvestCourseLinks,
  parseCoursePage,
} from "../import/smartcatalog";

export interface ScrapedDescription {
  description: string;
  url: string;
}

/** Fetch one course page and return its description, or null. Never throws. */
export async function scrapeOne(
  normalizedCode: string,
  harvestedUrl?: string
): Promise<ScrapedDescription | null> {
  const urls = [
    ...(harvestedUrl ? [harvestedUrl] : []),
    ...fallbackUrls(normalizedCode),
  ];
  for (const url of urls) {
    const r = await fetchText(url);
    if (r.status !== 200) continue;
    const parsed = parseCoursePage(r.html);
    if (parsed.description) return { description: parsed.description, url };
  }
  return null;
}

/** Harvest the program pages once → Map<normalizedCode, absolute URL>. */
async function harvestProgramLinks(): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (const path of DEFAULT_PROGRAM_PATHS) {
    const r = await fetchText(path);
    if (r.status !== 200) continue;
    for (const [code, url] of harvestCourseLinks(r.html)) {
      if (!out.has(code)) out.set(code, url);
    }
  }
  return out;
}

export interface BatchResult {
  updated: string[];
  notFound: string[];
  errors: string[];
}

/**
 * Scrape up to `limit` of the given course codes and persist any hits.
 * The Descripciones page calls this repeatedly with the still-missing codes.
 */
export async function scrapeBatch(
  codes: string[],
  { limit = 8 }: { limit?: number } = {}
): Promise<BatchResult> {
  const target = codes.slice(0, limit);
  const res: BatchResult = { updated: [], notFound: [], errors: [] };
  if (target.length === 0) return res;

  const links = await harvestProgramLinks();

  for (const code of target) {
    try {
      const hit = await scrapeOne(code, links.get(code));
      if (!hit) {
        res.notFound.push(code);
        continue;
      }
      await prisma.course.updateMany({
        where: { normalizedCode: code },
        data: {
          description: hit.description,
          descriptionUrl: hit.url,
          descriptionSyncedAt: new Date(),
        },
      });
      res.updated.push(code);
    } catch {
      res.errors.push(code);
    }
  }
  return res;
}
