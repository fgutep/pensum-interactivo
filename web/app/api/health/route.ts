import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRawUnsafe("SELECT 1");
    return NextResponse.json({ ok: true, db: "up" });
  } catch (e) {
    return NextResponse.json(
      { ok: false, db: "down", error: e instanceof Error ? e.message : String(e) },
      { status: 503 }
    );
  }
}
