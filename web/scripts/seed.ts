// Populates a fresh DB from the two source spreadsheets. Replaces the old
// app/scripts/build-data.mjs. Idempotent: re-running upserts catalogs/courses
// and recreates catalog_course rows.
//
//   SEED_DIR=..  npm run seed          (local dev, files at repo root)
//   docker compose run --rm seed        (container: SEED_DIR=/repo)

import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

// Load web/.env for local runs. In the container, env comes from the process
// environment (docker-compose env_file), so a missing .env file is fine.
try {
  if (!process.env.DATABASE_URL) process.loadEnvFile(resolve(process.cwd(), ".env"));
} catch {
  /* no .env file — rely on process env */
}
import { parsePensumWorkbook } from "../lib/import/parsePensumWorkbook";
import { parsePrereqExport } from "../lib/import/parsePrereqExport";
import { persistParsedCatalog } from "../lib/import/persistCatalog";
import { OfferingsCache } from "../lib/pairing/offeringsCache";
import { prisma, applySqlitePragmas } from "../lib/db";

function findFile(dir: string, re: RegExp): string {
  const hit = readdirSync(dir).find((f) => re.test(f));
  if (!hit) throw new Error(`No file matching ${re} in ${dir}`);
  return join(dir, hit);
}

async function main() {
  const seedDir = resolve(process.cwd(), process.env.SEED_DIR ?? "..");
  const term = process.env.OFFERINGS_TERM ?? "202620";
  const pair = process.env.SEED_SKIP_PAIRING !== "1";

  const pensumPath = findFile(seedDir, /^PENSUMS.*\.xlsx$/i);
  const prereqPath = findFile(seedDir, /^PRERREQUISITOS.*\.xlsx$/i);
  console.log(`seed dir : ${seedDir}`);
  console.log(`pensum   : ${pensumPath}`);
  console.log(`prereqs  : ${prereqPath}`);
  console.log(`term     : ${term}   pairing: ${pair ? "on" : "off"}`);

  await applySqlitePragmas();

  const catalogs = parsePensumWorkbook(readFileSync(pensumPath));
  const prereqMap = parsePrereqExport(readFileSync(prereqPath));
  console.log(`\nparsed ${catalogs.length} catalogs, ${prereqMap.size} prereq rows\n`);

  const cache = new OfferingsCache();
  for (const parsed of catalogs) {
    if (parsed.warnings.length) {
      console.log(`  ! ${parsed.slug} warnings:`);
      for (const w of parsed.warnings.slice(0, 10)) console.log(`      - ${w}`);
    }
    const res = await persistParsedCatalog(parsed, prereqMap, {
      status: "published",
      term,
      sourceFilename: pensumPath.split("/").pop(),
      pair,
      cache,
    });
    console.log(
      `  ✓ ${res.slug.padEnd(14)} ${String(res.courseCount).padStart(3)} courses  ` +
        `auto=${res.pairing.auto_paired} not_offered=${res.pairing.not_offered} ` +
        `manual=${res.pairing.needs_manual} pool=${res.pairing.placeholder_pool} ` +
        `sync_failed=${res.pairing.sync_failed}` +
        (res.apiFailureRate > 0 ? `  (api fail ${(res.apiFailureRate * 100).toFixed(0)}%)` : "")
    );
  }

  console.log("\ndone.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
