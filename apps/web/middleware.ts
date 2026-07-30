import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "./lib/auth";

// The marketing landing is public; the dashboard behind it is not.
const PUBLIC_PATHS = new Set(["/"]);

export async function middleware(request: NextRequest) {
  if (PUBLIC_PATHS.has(request.nextUrl.pathname)) {
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
