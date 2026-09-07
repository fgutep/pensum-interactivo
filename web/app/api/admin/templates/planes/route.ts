import { NextResponse } from "next/server";
import { buildPlanesWorkbook, workbookToBuffer } from "@/lib/export/buildTemplates";
import { writeAudit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export async function GET() {
  const buf = await workbookToBuffer(await buildPlanesWorkbook());
  await writeAudit({
    action: "templates.download",
    entityType: "Template",
    entityId: "PLANES.xlsx",
  });
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": XLSX_MIME,
      "Content-Disposition": 'attachment; filename="PLANES.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
