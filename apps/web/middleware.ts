import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "./lib/auth";
import { landingEnabled } from "./lib/landing";

export async function middleware(request: NextRequest) {
  // The marketing landing is public — but only where it's turned on. On a
  // self-hosted instance `/` is gated like everything else and falls through
  // to the login redirect below.
  if (request.nextUrl.pathname === "/" && landingEnabled()) {
    return NextResponse.next();
  }

  const secret = process.env.ADMIN_SECRET;
  const token = request.cookies.get(SESSION_COOKIE)?.value;

  const authed =
    secret && token ? await verifySessionToken(secret, token) : false;

  if (!authed) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Skip the login screen, framework internals, and any static file (has a
  // dot) — the landing itself is allowed above.
  matcher: ["/((?!login|_next/static|_next/image|.*\\..*).*)"],
};
