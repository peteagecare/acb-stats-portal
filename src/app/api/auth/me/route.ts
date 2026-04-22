import { NextRequest } from "next/server";
import { parseSessionToken, AUTH_COOKIE_NAME } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const user = parseSessionToken(token);
  if (!user) {
    return Response.json({ email: null, role: "viewer" });
  }

  // Admin impersonation — return the viewed-as email but flag it
  const viewAs = request.cookies.get("view_hub_as")?.value;
  if (viewAs && user.role === "admin") {
    return Response.json({
      email: viewAs,
      role: "viewer",
      realEmail: user.email,
      realRole: user.role,
      impersonating: true,
    });
  }

  return Response.json({ email: user.email, role: user.role, impersonating: false });
}
