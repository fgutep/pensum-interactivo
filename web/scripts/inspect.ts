// Ad-hoc DB inspection for development / P0 verification.
//   npm exec tsx scripts/inspect.ts
import { resolve } from "node:path";
try {
  if (!process.env.DATABASE_URL) process.loadEnvFile(resolve(process.cwd(), ".env"));
} catch {}
import { prisma } from "../lib/db";

async function main() {
  const perCatalog = await prisma.$queryRawUnsafe<
    { slug: string; mn: number; mx: number; n: number; ph: number }[]
  >(
    `SELECT c.slug, MIN(cc.suggestedSemester) mn, MAX(cc.suggestedSemester) mx,
            COUNT(*) n, SUM(cc.isPlaceholder) ph
       FROM CatalogCourse cc JOIN Catalog c ON c.id = cc.catalogId
      GROUP BY c.slug ORDER BY c.slug`
  );
  console.log("\n== catalogs ==");
  console.table(perCatalog);

  const pairing = await prisma.$queryRawUnsafe<
    { slug: string; pairingStatus: string; n: number }[]
  >(
    `SELECT c.slug, cc.pairingStatus, COUNT(*) n
       FROM CatalogCourse cc JOIN Catalog c ON c.id = cc.catalogId
      WHERE cc.isPlaceholder = 0
      GROUP BY c.slug, cc.pairingStatus ORDER BY c.slug, cc.pairingStatus`
  );
  console.log("\n== pairing status (real courses only) ==");
  console.table(pairing);

  const sem1 = await prisma.catalogCourse.findMany({
    where: { catalog: { slug: "iele-cbu3" }, suggestedSemester: 1 },
    orderBy: { sortIndex: "asc" },
    select: { displayCode: true, name: true, isPlaceholder: true, pairingStatus: true },
  });
  console.log("\n== iele-cbu3 semester 1 ==");
  console.table(sem1);

  const mate = await prisma.catalogCourse.findFirst({
    where: { catalog: { slug: "iele-cbu3" }, displayCode: "MATE 1203" },
    select: { displayCode: true, prereqText: true, prereqTree: true },
  });
  console.log("\n== MATE 1203 prereq ==");
  console.dir(mate, { depth: 8 });

  const offerings = await prisma.courseOffering.count();
  const withDetails = await prisma.courseOffering.count({
    where: { detailsSyncedAt: { not: null }, detailsError: null },
  });
  console.log(
    `\n== course_offering rows: ${offerings}  (with courseDetails: ${withDetails}) ==`
  );

  const detailSample = await prisma.courseOffering.findFirst({
    where: { course: { normalizedCode: "IELE2002" } },
    select: {
      term: true,
      detailsNrc: true,
      apiPrereqText: true,
      apiPrereqTree: true,
      apiCoreq: true,
      apiCoreqTree: true,
      restrictions: true,
    },
  });
  console.log("\n== IELE2002 courseDetails ==");
  console.dir(detailSample, { depth: 8 });

  await prisma.$disconnect();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
