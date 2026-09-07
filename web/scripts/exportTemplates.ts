// Writes the coordinator import templates to disk. The workbook builders live in
// lib/export/buildTemplates.ts (shared with the admin download routes).
//
//   npm run export:templates            -> ../plantillas/PLANES.xlsx + ELECTIVAS.xlsx
//   TEMPLATES_DIR=/some/dir npm run export:templates
//
// See scripts/exportTemplates.md for the format contract.

import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
try {
  if (!process.env.DATABASE_URL) process.loadEnvFile(resolve(process.cwd(), ".env"));
} catch {
  /* rely on process env */
}
import { prisma } from "../lib/db";
import {
  buildElectivasWorkbook,
  buildPlanesWorkbook,
} from "../lib/export/buildTemplates";

async function main() {
  const outDir = resolve(
    process.cwd(),
    process.env.TEMPLATES_DIR ?? "../plantillas"
  );
  mkdirSync(outDir, { recursive: true });

  const planes = await buildPlanesWorkbook();
  const planesPath = resolve(outDir, "PLANES.xlsx");
  await planes.xlsx.writeFile(planesPath);
  console.log(`  ✓ ${planesPath}`);

  const electivas = await buildElectivasWorkbook();
  const electivasPath = resolve(outDir, "ELECTIVAS.xlsx");
  await electivas.xlsx.writeFile(electivasPath);
  console.log(`  ✓ ${electivasPath}`);

  console.log("\ndone.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
