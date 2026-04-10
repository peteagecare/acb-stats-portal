import { NextRequest } from "next/server";
import { createMagicLinkToken } from "@/lib/auth";
import { sendLoginLink } from "@/lib/email";
import { rateLimit, clientKey } from "@/lib/rate-limit";

const ALLOWED_DOMAIN = (process.env.ALLOWED_EMAIL_DOMAIN ?? "agecare-bathrooms.co.uk").toLowerCase();
// Conservative RFC-ish email regex — good enough for staff emails
const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export async function POST(request: NextRequest) {
  // Per-IP throttle: 5 requests per 10 minutes
  const limit = rateLimit(`login-request:${clientKey(request)}`, 5, 10 * 60_000);
  if (!limit.ok) {
    return Response.json(
      { error: "Too many login requests. Try again shortly." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((limit.resetAt - Date.now()) / 1000)),
        },
      },
    );
  }

  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) {
    return Response.json({ error: "Please enter a valid email address." }, { status: 400 });
  }
  if (!email.endsWith(`@${ALLOWED_DOMAIN}`)) {
    // Don't reveal the allowed domain for unauthenticated callers
    return Response.json(
      { error: "That email address is not authorised to access this dashboard." },
      { status: 403 },
    );
  }

  const token = createMagicLinkToken(email);
  const origin = request.nextUrl.origin;
  const link = `${origin}/api/login/verify?token=${encodeURIComponent(token)}`;

  try {
    await sendLoginLink(email, link);
  } catch (e) {
    console.error("[login/request] sendLoginLink failed:", e);
    return Response.json(
      { error: "Could not send login email. Contact the site admin." },
      { status: 500 },
    );
  }

  return Response.json({ ok: true });
}
