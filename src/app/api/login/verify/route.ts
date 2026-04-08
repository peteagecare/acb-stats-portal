import { NextRequest, NextResponse } from "next/server";
import {
  verifyMagicLinkToken,
  createSessionToken,
  AUTH_COOKIE_NAME,
  AUTH_COOKIE_MAX_AGE,
} from "@/lib/auth";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!verifyMagicLinkToken(token)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "?error=invalid";
    return NextResponse.redirect(url);
  }

  const session = createSessionToken();
  const url = request.nextUrl.clone();
  url.pathname = "/";
  url.search = "";
  const res = NextResponse.redirect(url);
  res.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: session,
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: AUTH_COOKIE_MAX_AGE,
  });
  return res;
}
