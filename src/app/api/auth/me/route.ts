import { NextRequest } from "next/server";
import { parseSessionToken, AUTH_COOKIE_NAME } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const user = parseSessionToken(token);
  if (!user) {
    // Logged in with old-format token (pre-roles) — treat as viewer
    return Response.json({ email: null, role: "viewer" });
  }
  return Response.json({ email: user.email, role: user.role });
}
