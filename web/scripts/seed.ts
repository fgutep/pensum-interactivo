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
import { parseElectivesWorkbook } from "../lib/import/parseElectivesWorkbook";
import { identityForSlug } from "../lib/catalogIdentity";
import { rulesForSlug } from "../lib/catalogRules";
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
    const maxSemester = parsed.courses.reduce((m, c) => Math.max(m, c.semester), 0);
    const id = identityForSlug(parsed.slug);
    const res = await persistParsedCatalog(parsed, prereqMap, {
      status: "published",
      term,
      sourceFilename: pensumPath.split("/").pop(),
      pair,
      cache,
      identity: {
        accentColor: id.accentColor,
        tagline: id.tagline,
        imagePath: id.imagePath,
        subtitle: maxSemester ? `CBU3 · ${maxSemester} semestres` : "CBU3",
      },
      rules: rulesForSlug(parsed.slug),
    });
    console.log(
      `  ✓ ${res.slug.padEnd(14)} ${String(res.courseCount).padStart(3)} courses  ` +
        `auto=${res.pairing.auto_paired} not_offered=${res.pairing.not_offered} ` +
        `manual=${res.pairing.needs_manual} pool=${res.pairing.placeholder_pool} ` +
        `sync_failed=${res.pairing.sync_failed}` +
        (res.apiFailureRate > 0 ? `  (api fail ${(res.apiFailureRate * 100).toFixed(0)}%)` : "")
    );
  }

  // ---- electives bag (Custom_Pensum/electivas/*.xlsx) ----
  const electivesDir = resolve(seedDir, process.env.ELECTIVAS_DIR ?? "electivas");
  let electiveFiles: string[] = [];
  try {
    electiveFiles = readdirSync(electivesDir)
      .filter((f) => /\.xlsx$/i.test(f) && !f.startsWith("~$"))
      .map((f) => join(electivesDir, f));
  } catch {
    console.log(`\nno electives dir at ${electivesDir} — skipping electives`);
  }

  if (electiveFiles.length) {
    console.log(`\nelectives dir : ${electivesDir}`);
    const parsedElectives = parseElectivesWorkbook(
      electiveFiles.map((p) => ({ name: p.split("/").pop() ?? p, buffer: readFileSync(p) }))
    );
    let withTerm = 0;
    for (const e of parsedElectives) {
      if (e.offeredTerms.includes(term)) withTerm += 1;
      await prisma.elective.upsert({
        where: { normalizedName: e.normalizedName },
        create: {
          name: e.name,
          normalizedName: e.normalizedName,
          level: e.level,
          ciclo: e.ciclo,
          roles: e.roles as object,
          offeredTerms: e.offeredTerms,
          sourceFiles: e.sourceFiles,
        },
        update: {
          name: e.name,
          level: e.level,
          ciclo: e.ciclo,
          roles: e.roles as object,
          offeredTerms: e.offeredTerms,
          sourceFiles: e.sourceFiles,
        },
      });
    }
    console.log(
      `  ✓ ${String(parsedElectives.length).padStart(3)} electives  (${withTerm} ofertadas en ${term})`
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
