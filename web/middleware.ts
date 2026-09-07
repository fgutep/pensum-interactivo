import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";

// Gate everything under /administrador and /api/admin except the login/logout
// endpoints. Runs on the Edge runtime — session.ts uses Web Crypto only.
export const config = {
  matcher: ["/administrador/:path*", "/api/admin/:path*"],
};

const PUBLIC_PATHS = new Set([
  "/administrador/login",
  "/api/admin/login",
  "/api/admin/logout",
]);

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (await verifySessionToken(token)) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/administrador/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}
