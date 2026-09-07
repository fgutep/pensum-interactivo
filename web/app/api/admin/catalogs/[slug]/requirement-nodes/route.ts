import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { normalizeCode } from "@/lib/import/normalizeCode";

export const runtime = "nodejs";

function linkedCodes(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((s) => normalizeCode(String(s))).filter(Boolean);
  return String(v ?? "")
    .split(/[,\n;]+/)
    .map((s) => normalizeCode(s))
    .filter(Boolean);
}

/** POST — add a RequirementNode to this plan. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const catalog = await prisma.catalog.findUnique({ where: { slug } });
  if (!catalog) {
    return NextResponse.json({ error: "Plan no encontrado." }, { status: 404 });
  }
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const key = String(body?.key ?? "").trim();
  const label = String(body?.label ?? "").trim();
  if (!key || !label) {
    return NextResponse.json({ error: "key y etiqueta son obligatorios." }, { status: 400 });
  }
  const semester = Number(body?.semester);
  const autoLinkRegex = String(body?.autoLinkRegex ?? "").trim() || null;
  if (autoLinkRegex) {
    try {
      new RegExp(autoLinkRegex);
    } catch {
      return NextResponse.json({ error: "Regex de auto-enlace inválida." }, { status: 400 });
    }
  }

  try {
    const created = await prisma.requirementNode.create({
      data: {
        catalogId: catalog.id,
        key,
        label,
        description: String(body?.description ?? "").trim() || null,
        infoUrl: String(body?.infoUrl ?? "").trim() || null,
        semester: Number.isFinite(semester) && semester > 0 ? semester : 5,
        sortIndex: Number(body?.sortIndex) || 9999,
        attestationId: String(body?.attestationId ?? "").trim() || null,
        autoLinkRegex,
        linkedCourseCodes: linkedCodes(body?.linkedCourseCodes) as unknown as Prisma.InputJsonValue,
      },
    });
    await writeAudit({
      action: "requirementNode.create",
      entityType: "RequirementNode",
      entityId: created.id,
      after: { slug, key, label },
    });
    return NextResponse.json({ ok: true, id: created.id });
  } catch {
    return NextResponse.json(
      { error: `Ya existe un nodo con key "${key}" en este plan.` },
      { status: 409 }
    );
  }
}
