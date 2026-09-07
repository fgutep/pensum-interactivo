import { NextResponse } from "next/server";
import { adminPasswordConfigured, checkAdminPassword } from "@/lib/auth/password";
import {
  SESSION_COOKIE,
  createSessionToken,
  sessionCookieOptions,
} from "@/lib/auth/session";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!adminPasswordConfigured()) {
    return NextResponse.json(
      { error: "El servidor no tiene ADMIN_PASSWORD configurado." },
      { status: 500 }
    );
  }
  let password = "";
  try {
    const body = (await req.json()) as { password?: unknown };
    password = String(body.password ?? "");
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }
  if (!checkAdminPassword(password)) {
    return NextResponse.json({ error: "Contraseña incorrecta." }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await createSessionToken(), sessionCookieOptions());
  return res;
}
