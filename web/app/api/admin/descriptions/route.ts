import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { scrapeBatch } from "@/lib/scrape/descriptionSync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — description coverage across the global course registry. */
export async function GET() {
  const courses = await prisma.course.findMany({
    select: { normalizedCode: true, description: true },
    orderBy: { normalizedCode: "asc" },
  });
  const missing = courses
    .filter((c) => !c.description)
    .map((c) => c.normalizedCode);
  return NextResponse.json({
    total: courses.length,
    withDescription: courses.length - missing.length,
    missing,
  });
}

/** POST { codes, limit? } — scrape a chunk; returns what was updated/missed. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as
    | { codes?: string[]; limit?: number }
    | null;
  const codes = Array.isArray(body?.codes)
    ? body!.codes.map((c) => String(c).toUpperCase()).filter(Boolean)
    : [];
  if (codes.length === 0) {
    return NextResponse.json({ updated: [], notFound: [], errors: [] });
  }
  const limit = Math.min(Math.max(Number(body?.limit) || 8, 1), 20);
  const result = await scrapeBatch(codes, { limit });
  await writeAudit({
    action: "descriptions.scrape.batch",
    entityType: "Course",
    entityId: "batch",
    after: result,
  });
  return NextResponse.json(result);
}
