import { createHmac, timingSafeEqual, randomBytes } from "crypto";

const COOKIE_NAME = "acb_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14; // 14 days

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET must be set and at least 32 chars");
  }
  return secret;
}

function getDashboardPassword(): string {
  const pw = process.env.DASHBOARD_PASSWORD;
  if (!pw) throw new Error("DASHBOARD_PASSWORD must be set");
  return pw;
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("hex");
}

export function createSessionToken(): string {
  const issued = Math.floor(Date.now() / 1000);
  const nonce = randomBytes(8).toString("hex");
  const payload = `${issued}.${nonce}`;
  const sig = sign(payload);
  return `${payload}.${sig}`;
}

export function verifySessionToken(token: string | undefined): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [issuedStr, nonce, sig] = parts;
  const payload = `${issuedStr}.${nonce}`;
  const expected = sign(payload);
  if (sig.length !== expected.length) return false;
  try {
    if (!timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"))) {
      return false;
    }
  } catch {
    return false;
  }
  const issued = parseInt(issuedStr, 10);
  if (!Number.isFinite(issued)) return false;
  const ageSeconds = Math.floor(Date.now() / 1000) - issued;
  if (ageSeconds < 0 || ageSeconds > SESSION_TTL_SECONDS) return false;
  return true;
}

export function checkPassword(submitted: string): boolean {
  const expected = getDashboardPassword();
  const a = Buffer.from(submitted);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export const AUTH_COOKIE_NAME = COOKIE_NAME;
export const AUTH_COOKIE_MAX_AGE = SESSION_TTL_SECONDS;
