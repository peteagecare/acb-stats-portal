import { NextRequest } from "next/server";
import { parseSessionToken, AUTH_COOKIE_NAME } from "@/lib/auth";

const ADMIN_EMAIL = "pete@agecare-bathrooms.co.uk";

/** Vercel cron jobs hit our endpoint with `Authorization: Bearer <CRON_SECRET>`.
 *  We also let Pete trigger the job manually from the settings UI for testing —
 *  that path falls through to the session check. Returns true if authorised. */
export function isAuthorisedCron(request: NextRequest): boolean {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && auth === `Bearer ${secret}`) return true;

  // Manual trigger by Pete via the portal session
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const user = parseSessionToken(token);
  if (user && user.email.toLowerCase() === ADMIN_EMAIL) return true;

  return false;
}
