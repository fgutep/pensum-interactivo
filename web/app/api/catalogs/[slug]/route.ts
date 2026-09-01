import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { buildCatalogPayload } from "@/lib/catalogPayload";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const payload = await buildCatalogPayload(slug);
  if (!payload) {
    return NextResponse.json({ error: "catalog not found" }, { status: 404 });
  }

  const body = JSON.stringify(payload);
  const etag = `"${createHash("sha1").update(body).digest("hex")}"`;
  if (req.headers.get("if-none-match") === etag) {
    return new NextResponse(null, { status: 304, headers: { ETag: etag } });
  }

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      ETag: etag,
      "Cache-Control": "public, max-age=300",
    },
  });
}
