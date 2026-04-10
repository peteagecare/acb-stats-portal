import { NextRequest } from "next/server";
import { verifyTOTP, verifyTOTPWithSecret } from "@/lib/totp";
import {
  createSessionToken,
  AUTH_COOKIE_NAME,
  AUTH_COOKIE_MAX_AGE,
} from "@/lib/auth";
import { rateLimit, clientKey } from "@/lib/rate-limit";
import { loadUsers } from "@/lib/users";

export async function POST(request: NextRequest) {
  const limit = rateLimit(`login-totp:${clientKey(request)}`, 5, 10 * 60_000);
  if (!limit.ok) {
    return Response.json(
      { error: "Too many attempts. Try again shortly." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((limit.resetAt - Date.now()) / 1000)),
        },
      },
    );
  }

  let body: { code?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const code = (body.code ?? "").trim();
  if (!/^\d{6}$/.test(code)) {
    return Response.json({ error: "Enter a 6-digit code." }, { status: 400 });
  }

  // Try matching against registered users first
  try {
    const users = await loadUsers();
    for (const user of users) {
      if (verifyTOTPWithSecret(code, user.totpSecret)) {
        const session = createSessionToken({ email: user.email, role: user.role });
        const res = Response.json({ ok: true });
        res.headers.append(
          "Set-Cookie",
          [
            `${AUTH_COOKIE_NAME}=${session}`,
            "Path=/",
            "HttpOnly",
            "Secure",
            "SameSite=Lax",
            `Max-Age=${AUTH_COOKIE_MAX_AGE}`,
          ].join("; "),
        );
        return res;
      }
    }
  } catch (e) {
    console.error("[login/totp] user lookup error:", e);
  }

  // Fallback: check env TOTP_SECRET (for backwards compat during migration)
  try {
    if (verifyTOTP(code)) {
      // Env-based login = admin (Pete)
      const session = createSessionToken({ email: "pete@agecare-bathrooms.co.uk", role: "admin" });
      const res = Response.json({ ok: true });
      res.headers.append(
        "Set-Cookie",
        [
          `${AUTH_COOKIE_NAME}=${session}`,
          "Path=/",
          "HttpOnly",
          "Secure",
          "SameSite=Lax",
          `Max-Age=${AUTH_COOKIE_MAX_AGE}`,
        ].join("; "),
      );
      return res;
    }
  } catch (e) {
    console.error("[login/totp] TOTP verification error:", e);
  }

  return Response.json({ error: "Invalid code. Try again." }, { status: 401 });
}
