import { NextRequest, NextResponse } from "next/server";
import {
  verifyMagicLinkToken,
  extractMagicLinkEmail,
  createSessionToken,
  AUTH_COOKIE_NAME,
  AUTH_COOKIE_MAX_AGE,
} from "@/lib/auth";
import { isAdmin } from "@/lib/users";

const IS_DEV = process.env.NODE_ENV === "development";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!verifyMagicLinkToken(token)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "?error=invalid";
    return NextResponse.redirect(url);
  }

  const email = extractMagicLinkEmail(token!) ?? "unknown@agecare-bathrooms.co.uk";
  const role = isAdmin(email) ? "admin" : "viewer";
  const session = createSessionToken({ email, role });

  const url = request.nextUrl.clone();
  url.pathname = "/";
  url.search = "";
  const res = NextResponse.redirect(url);
  res.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: session,
    path: "/",
    httpOnly: true,
    secure: !IS_DEV,
    sameSite: "lax",
    maxAge: AUTH_COOKIE_MAX_AGE,
  });
  return res;
}
