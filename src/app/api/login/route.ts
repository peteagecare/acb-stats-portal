import { NextRequest } from "next/server";
import {
  checkPassword,
  createSessionToken,
  AUTH_COOKIE_NAME,
  AUTH_COOKIE_MAX_AGE,
} from "@/lib/auth";

export async function POST(request: NextRequest) {
  let body: { password?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }

  const password = body.password ?? "";
  if (!password || !checkPassword(password)) {
    // Tiny delay to slow brute force attempts
    await new Promise((r) => setTimeout(r, 400));
    return Response.json({ error: "invalid password" }, { status: 401 });
  }

  const token = createSessionToken();
  const res = Response.json({ ok: true });
  res.headers.append(
    "Set-Cookie",
    [
      `${AUTH_COOKIE_NAME}=${token}`,
      "Path=/",
      "HttpOnly",
      "Secure",
      "SameSite=Lax",
      `Max-Age=${AUTH_COOKIE_MAX_AGE}`,
    ].join("; "),
  );
  return res;
}
