import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySessionToken, AUTH_COOKIE_NAME } from "@/lib/auth";

const PUBLIC_PATHS = new Set<string>([
  "/login",
  "/api/login/request",
  "/api/login/verify",
  "/api/login/totp",
  "/api/logout",
  "/favicon.ico",
  "/acb-logo.png",
]);

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (pathname.startsWith("/_next/")) return true;
  // Cron endpoints handle their own auth via CRON_SECRET / admin-session check
  if (pathname.startsWith("/api/cron/")) return true;
  return false;
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (isPublic(pathname)) return NextResponse.next();

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const authed = verifySessionToken(token);

  if (authed) return NextResponse.next();

  // API requests get a 401, everything else is redirected to /login
  if (pathname.startsWith("/api/")) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    // Run on every path except Next internals and static assets
    "/((?!_next/static|_next/image|favicon.ico|acb-logo.png).*)",
  ],
};
