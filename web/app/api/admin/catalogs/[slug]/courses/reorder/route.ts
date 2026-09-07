import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";

export const runtime = "nodejs";

/** POST { aId, bId } — swap the sortIndex of two rows in this plan. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const body = (await req.json().catch(() => null)) as
    | { aId?: number; bId?: number }
    | null;
  const aId = Number(body?.aId);
  const bId = Number(body?.bId);
  if (!Number.isFinite(aId) || !Number.isFinite(bId) || aId === bId) {
    return NextResponse.json({ error: "aId / bId inválidos." }, { status: 400 });
  }

  const rows = await prisma.catalogCourse.findMany({
    where: { id: { in: [aId, bId] }, catalog: { slug } },
    select: { id: true, sortIndex: true },
  });
  if (rows.length !== 2) {
    return NextResponse.json({ error: "Filas no encontradas." }, { status: 404 });
  }
  const a = rows.find((r) => r.id === aId)!;
  const b = rows.find((r) => r.id === bId)!;

  await prisma.$transaction([
    prisma.catalogCourse.update({ where: { id: a.id }, data: { sortIndex: -1 } }),
    prisma.catalogCourse.update({ where: { id: b.id }, data: { sortIndex: a.sortIndex } }),
    prisma.catalogCourse.update({ where: { id: a.id }, data: { sortIndex: b.sortIndex } }),
  ]);
  await writeAudit({
    action: "course.reorder",
    entityType: "Catalog",
    entityId: slug,
    after: { aId, bId },
  });
  return NextResponse.json({ ok: true });
}
