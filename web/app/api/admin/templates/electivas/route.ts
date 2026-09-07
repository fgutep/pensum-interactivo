import { NextResponse } from "next/server";
import {
  buildElectivasWorkbook,
  workbookToBuffer,
} from "@/lib/export/buildTemplates";
import { writeAudit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export async function GET() {
  const buf = await workbookToBuffer(await buildElectivasWorkbook());
  await writeAudit({
    action: "templates.download",
    entityType: "Template",
    entityId: "ELECTIVAS.xlsx",
  });
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": XLSX_MIME,
      "Content-Disposition": 'attachment; filename="ELECTIVAS.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
