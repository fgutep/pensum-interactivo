import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { parsePlanesWorkbook } from "@/lib/import/parsePlanesWorkbook";
import { buildPlanesDiff } from "@/lib/import/diffPlanes";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const file = form?.get("planes");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Adjunta el archivo PLANES.xlsx en el campo 'planes'." },
      { status: 400 }
    );
  }
  if (!/\.xlsx$/i.test(file.name)) {
    return NextResponse.json({ error: "El archivo debe ser .xlsx." }, { status: 400 });
  }

  let parsed;
  try {
    parsed = parsePlanesWorkbook(Buffer.from(await file.arrayBuffer()));
  } catch (e) {
    return NextResponse.json(
      { error: "No se pudo leer el .xlsx: " + (e as Error).message },
      { status: 400 }
    );
  }

  const diff = await buildPlanesDiff(parsed, prisma);
  const job = await prisma.importJob.create({
    data: {
      filename: file.name,
      uploadedBy: "admin",
      status: "parsed",
      scope: "all",
      diff: diff as unknown as object,
      parsedPayload: parsed as unknown as object,
      warnings: diff.warnings as unknown as object,
    },
  });
  await writeAudit({
    action: "import.upload",
    entityType: "ImportJob",
    entityId: job.id,
    after: { filename: file.name, counts: diff.counts },
  });
  return NextResponse.json({ jobId: job.id, counts: diff.counts });
}
