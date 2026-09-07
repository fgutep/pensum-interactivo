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

async function load(slug: string, id: number) {
  return prisma.requirementNode.findFirst({ where: { id, catalog: { slug } } });
}

/** PATCH — edit one RequirementNode. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const { slug, id: idStr } = await params;
  const id = Number(idStr);
  const node = await load(slug, id);
  if (!node) return NextResponse.json({ error: "Nodo no encontrado." }, { status: 404 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Cuerpo inválido." }, { status: 400 });

  const data: Prisma.RequirementNodeUncheckedUpdateInput = {};
  if ("label" in body) data.label = String(body.label ?? "").trim() || node.label;
  if ("description" in body) data.description = String(body.description ?? "").trim() || null;
  if ("infoUrl" in body) data.infoUrl = String(body.infoUrl ?? "").trim() || null;
  if ("attestationId" in body)
    data.attestationId = String(body.attestationId ?? "").trim() || null;
  if ("semester" in body) {
    const n = Number(body.semester);
    if (Number.isFinite(n) && n > 0) data.semester = n;
  }
  if ("sortIndex" in body) {
    const n = Number(body.sortIndex);
    if (Number.isFinite(n)) data.sortIndex = n;
  }
  if ("autoLinkRegex" in body) {
    const re = String(body.autoLinkRegex ?? "").trim() || null;
    if (re) {
      try {
        new RegExp(re);
      } catch {
        return NextResponse.json({ error: "Regex de auto-enlace inválida." }, { status: 400 });
      }
    }
    data.autoLinkRegex = re;
  }
  if ("linkedCourseCodes" in body) {
    data.linkedCourseCodes = linkedCodes(
      body.linkedCourseCodes
    ) as unknown as Prisma.InputJsonValue;
  }

  await prisma.requirementNode.update({ where: { id }, data });
  await writeAudit({
    action: "requirementNode.update",
    entityType: "RequirementNode",
    entityId: id,
    before: node,
    after: data,
  });
  return NextResponse.json({ ok: true });
}

/** DELETE — remove one RequirementNode. */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const { slug, id: idStr } = await params;
  const id = Number(idStr);
  const node = await load(slug, id);
  if (!node) return NextResponse.json({ error: "Nodo no encontrado." }, { status: 404 });
  await prisma.requirementNode.delete({ where: { id } });
  await writeAudit({
    action: "requirementNode.delete",
    entityType: "RequirementNode",
    entityId: id,
    before: node,
  });
  return NextResponse.json({ ok: true });
}
