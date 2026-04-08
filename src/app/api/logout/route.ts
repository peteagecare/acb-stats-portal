import { AUTH_COOKIE_NAME } from "@/lib/auth";

export async function POST() {
  const res = Response.json({ ok: true });
  res.headers.append(
    "Set-Cookie",
    [
      `${AUTH_COOKIE_NAME}=`,
      "Path=/",
      "HttpOnly",
      "Secure",
      "SameSite=Lax",
      "Max-Age=0",
    ].join("; "),
  );
  return res;
}
