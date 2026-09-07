import { NextResponse } from "next/server";
import { applyPlanesJob } from "@/lib/import/applyPlanes";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await ctx.params;
  const id = Number(jobId);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "jobId inválido" }, { status: 400 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    confirmRemovals?: boolean;
    forceConflicts?: boolean;
    excludeKeys?: string[];
  };
  try {
    const result = await applyPlanesJob(id, {
      confirmRemovals: !!body.confirmRemovals,
      forceConflicts: !!body.forceConflicts,
      excludeKeys: Array.isArray(body.excludeKeys)
        ? body.excludeKeys.map(String)
        : undefined,
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 409 });
  }
}
