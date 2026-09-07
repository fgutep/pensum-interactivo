import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { normalizeCode } from "@/lib/import/normalizeCode";
import { scrapeOne } from "@/lib/scrape/descriptionSync";

export const runtime = "nodejs";

/** POST — scrape the catalog description for one course from smartcatalogiq. */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const code = normalizeCode(decodeURIComponent((await params).code));
  const course = await prisma.course.findUnique({ where: { normalizedCode: code } });
  if (!course) {
    return NextResponse.json({ error: "Curso no encontrado." }, { status: 404 });
  }

  const hit = await scrapeOne(code);
  if (!hit) {
    return NextResponse.json(
      { error: "No se encontró descripción en el catálogo." },
      { status: 404 }
    );
  }

  const updated = await prisma.course.update({
    where: { normalizedCode: code },
    data: {
      description: hit.description,
      descriptionUrl: hit.url,
      descriptionSyncedAt: new Date(),
    },
  });
  await writeAudit({
    action: "course.description.scrape",
    entityType: "Course",
    entityId: code,
    before: { description: course.description },
    after: { description: hit.description, url: hit.url },
  });
  return NextResponse.json({
    description: updated.description,
    descriptionUrl: updated.descriptionUrl,
    descriptionSyncedAt: updated.descriptionSyncedAt,
  });
}

/** PATCH — save a hand-entered description (clears descriptionSyncedAt). */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const code = normalizeCode(decodeURIComponent((await params).code));
  const body = (await req.json().catch(() => null)) as { description?: string } | null;
  if (body == null || typeof body.description !== "string") {
    return NextResponse.json({ error: "Falta 'description'." }, { status: 400 });
  }
  const course = await prisma.course.findUnique({ where: { normalizedCode: code } });
  if (!course) {
    return NextResponse.json({ error: "Curso no encontrado." }, { status: 404 });
  }
  const text = body.description.trim();
  const updated = await prisma.course.update({
    where: { normalizedCode: code },
    data: {
      description: text || null,
      descriptionSyncedAt: null,
    },
  });
  await writeAudit({
    action: "course.description.update",
    entityType: "Course",
    entityId: code,
    before: { description: course.description },
    after: { description: updated.description },
  });
  return NextResponse.json({ description: updated.description });
}
