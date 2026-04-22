import { NextRequest, NextResponse } from "next/server";
import { parseSessionToken, AUTH_COOKIE_NAME } from "@/lib/auth";

const COOKIE_NAME = "view_hub_as";

export async function POST(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const user = parseSessionToken(token);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const { email } = await request.json();
  const res = NextResponse.json({ ok: true, viewAs: email || null });

  if (email) {
    res.cookies.set(COOKIE_NAME, email, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 86400,
    });
  } else {
    res.cookies.delete(COOKIE_NAME);
  }

  return res;
}
