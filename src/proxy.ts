import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";

// Pages accessibles sans être connecté.
const PUBLIC_PATHS = ["/connexion", "/bienvenue"];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))
  ) {
    return NextResponse.next();
  }

  const uid = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (uid) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/connexion";
  url.searchParams.set("suite", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
