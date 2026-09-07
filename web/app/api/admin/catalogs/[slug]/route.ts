import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";

export const runtime = "nodejs";

const STRING_FIELDS = [
  "programName",
  "programCode",
  "variantLabel",
  "term",
  "status",
  "accentColor",
  "tagline",
  "subtitle",
  "imagePath",
] as const;

const STATUSES = new Set(["draft", "published", "archived"]);

/** PATCH — catalog presentation identity + status. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const catalog = await prisma.catalog.findUnique({ where: { slug } });
  if (!catalog) {
    return NextResponse.json({ error: "Plan no encontrado." }, { status: 404 });
  }
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ error: "Cuerpo inválido." }, { status: 400 });
  }

  const REQUIRED = new Set(["programName", "programCode", "term"]);
  const data: Record<string, string | null> = {};
  for (const f of STRING_FIELDS) {
    if (!(f in body)) continue;
    const v = body[f] == null ? "" : String(body[f]).trim();
    if (f === "status" && v && !STATUSES.has(v)) {
      return NextResponse.json({ error: `Estado inválido: ${v}` }, { status: 400 });
    }
    if (REQUIRED.has(f) && !v) {
      return NextResponse.json({ error: `"${f}" no puede quedar vacío.` }, { status: 400 });
    }
    // required + variantLabel are non-null columns; the rest are nullable
    data[f] = REQUIRED.has(f) || f === "variantLabel" || f === "status" ? v : v || null;
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ ok: true, unchanged: true });
  }

  const before = Object.fromEntries(
    Object.keys(data).map((k) => [k, (catalog as Record<string, unknown>)[k]])
  );
  const updated = await prisma.catalog.update({ where: { slug }, data });
  await writeAudit({
    action: "catalog.update",
    entityType: "Catalog",
    entityId: slug,
    before,
    after: data,
  });
  return NextResponse.json({ ok: true, catalog: updated });
}
