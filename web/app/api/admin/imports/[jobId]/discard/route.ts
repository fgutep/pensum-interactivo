import { NextResponse } from "next/server";
import { discardImportJob } from "@/lib/import/applyPlanes";

export const runtime = "nodejs";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await ctx.params;
  const id = Number(jobId);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "jobId inválido" }, { status: 400 });
  }
  try {
    await discardImportJob(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 409 });
  }
}
