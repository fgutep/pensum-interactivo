import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import type { Attestation, GateRule } from "@/lib/types";

export const runtime = "nodejs";

function badRegex(src: unknown): boolean {
  if (src == null || src === "") return false;
  try {
    new RegExp(String(src));
    return false;
  } catch {
    return true;
  }
}

/** PATCH — replace Catalog.rules ({ gates, attestations }) for this plan. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const catalog = await prisma.catalog.findUnique({ where: { slug } });
  if (!catalog) {
    return NextResponse.json({ error: "Plan no encontrado." }, { status: 404 });
  }
  const body = (await req.json().catch(() => null)) as
    | { gates?: unknown; attestations?: unknown }
    | null;
  if (!body || !Array.isArray(body.gates) || !Array.isArray(body.attestations)) {
    return NextResponse.json(
      { error: "Se esperaba { gates: [], attestations: [] }." },
      { status: 400 }
    );
  }

  const attestations = body.attestations as Attestation[];
  const gates = body.gates as GateRule[];

  for (const a of attestations) {
    if (!a?.id || !a?.label) {
      return NextResponse.json(
        { error: "Cada atestación necesita id y etiqueta." },
        { status: 400 }
      );
    }
    if (badRegex(a.autoGatePrereqRegex)) {
      return NextResponse.json(
        { error: `Regex inválida en la atestación "${a.id}".` },
        { status: 400 }
      );
    }
  }
  for (const g of gates) {
    if (!g?.id || !g?.label) {
      return NextResponse.json(
        { error: "Cada gate necesita id y etiqueta." },
        { status: 400 }
      );
    }
    if (badRegex(g.appliesTo?.codeRegex) || badRegex(g.condition?.allApprovedMatching)) {
      return NextResponse.json(
        { error: `Regex inválida en el gate "${g.id}".` },
        { status: 400 }
      );
    }
  }

  const rules = { gates, attestations } as unknown as Prisma.InputJsonValue;
  await prisma.catalog.update({ where: { slug }, data: { rules } });
  await writeAudit({
    action: "catalog.rules.update",
    entityType: "Catalog",
    entityId: slug,
    before: catalog.rules,
    after: { gates, attestations },
  });
  return NextResponse.json({ ok: true });
}
