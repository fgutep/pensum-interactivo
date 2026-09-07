// Populates Course.description from uniandes.smartcatalogiq.com.
//
//   npm run scrape:desc                 # only courses missing a description
//   SCRAPE_FORCE=1 npm run scrape:desc  # re-fetch every course
//   ONLY=IELE2100,MATE1203 npm run scrape:desc
//   SMARTCATALOG_PROGRAM_URLS=/es-es/... npm run scrape:desc
//
// Standalone by design: `npm run seed` never touches Course.description, so a
// scrape (or a later manual edit) survives re-seeding.  See scrapeDescriptions.md.

import { resolve } from "node:path";
try {
  if (!process.env.DATABASE_URL) process.loadEnvFile(resolve(process.cwd(), ".env"));
} catch {
  /* rely on process env */
}
import { prisma } from "../lib/db";
import {
  DEFAULT_PROGRAM_PATHS,
  fallbackUrls,
  fetchText,
  harvestCourseLinks,
  parseCoursePage,
} from "../lib/import/smartcatalog";

function pLimit(concurrency: number) {
  let active = 0;
  const queue: (() => void)[] = [];
  const next = () => {
    active--;
    queue.shift()?.();
  };
  return function run<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((res, rej) => {
      const exec = () => {
        active++;
        fn().then(res, rej).finally(next);
      };
      active < concurrency ? exec() : queue.push(exec);
    });
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const force = process.env.SCRAPE_FORCE === "1";
  const only = (process.env.ONLY ?? "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  const programPaths = (
    process.env.SMARTCATALOG_PROGRAM_URLS
      ? process.env.SMARTCATALOG_PROGRAM_URLS.split(",")
      : DEFAULT_PROGRAM_PATHS
  ).map((s) => s.trim());

  // 1. harvest course-page URLs from the program pages
  const codeToUrl = new Map<string, string>();
  for (const path of programPaths) {
    const r = await fetchText(path);
    if (r.status !== 200) {
      console.warn(`  ! program page ${r.status}: ${r.url}`);
      continue;
    }
    const links = harvestCourseLinks(r.html);
    for (const [code, url] of links) if (!codeToUrl.has(code)) codeToUrl.set(code, url);
    console.log(`  program page: ${links.size} course links  (${path})`);
  }
  console.log(`\nharvested ${codeToUrl.size} distinct course links\n`);

  // 2. which courses to fetch
  const courses = await prisma.course.findMany({
    select: { id: true, normalizedCode: true, description: true },
    orderBy: { normalizedCode: "asc" },
  });
  const targets = courses.filter((c) => {
    if (only.length) return only.includes(c.normalizedCode);
    return force || !c.description;
  });
  console.log(`${targets.length} / ${courses.length} courses to scrape\n`);

  const limit = pLimit(Number(process.env.SCRAPE_CONCURRENCY ?? 4));
  let ok = 0;
  let miss = 0;
  let err = 0;

  await Promise.all(
    targets.map((c) =>
      limit(async () => {
        await sleep(120);
        const tried: string[] = [];
        const urls = [
          ...(codeToUrl.get(c.normalizedCode)
            ? [codeToUrl.get(c.normalizedCode)!]
            : []),
          ...fallbackUrls(c.normalizedCode),
        ];
        for (const url of urls) {
          tried.push(url);
          const r = await fetchText(url);
          if (r.status === 0) {
            err++;
            console.warn(`  ✗ ${c.normalizedCode} fetch error`);
            return;
          }
          if (r.status !== 200) continue;
          const parsed = parseCoursePage(r.html);
          if (!parsed.description) continue;
          await prisma.course.update({
            where: { id: c.id },
            data: {
              description: parsed.description,
              descriptionUrl: url,
              descriptionSyncedAt: new Date(),
            },
          });
          ok++;
          console.log(`  ✓ ${c.normalizedCode}  (${parsed.description.length} chars)`);
          return;
        }
        miss++;
        console.log(`  – ${c.normalizedCode}  no description found`);
      })
    )
  );

  console.log(`\ndone.  ${ok} updated, ${miss} not found, ${err} errors.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
