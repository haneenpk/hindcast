import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "./lib/auth";

export async function middleware(request: NextRequest) {
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
  // Everything is private except the login screen and framework assets.
  matcher: ["/((?!login|_next/static|_next/image|icon.svg|favicon.ico).*)"],
};
