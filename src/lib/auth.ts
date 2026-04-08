import { createHmac, timingSafeEqual, randomBytes } from "crypto";

const COOKIE_NAME = "acb_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14; // 14 days
const MAGIC_LINK_TTL_SECONDS = 15 * 60; // 15 minutes

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET must be set and at least 32 chars");
  }
  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("hex");
}

function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
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
  if (!safeEqualHex(sig, expected)) return false;
  const issued = parseInt(issuedStr, 10);
  if (!Number.isFinite(issued)) return false;
  const ageSeconds = Math.floor(Date.now() / 1000) - issued;
  if (ageSeconds < 0 || ageSeconds > SESSION_TTL_SECONDS) return false;
  return true;
}

/* ── Magic-link tokens ─────────────────────────────────────────
   A signed, stateless one-time login token. Encoded as:
     <expiry>.<nonce>.<sig>
   Valid for 15 minutes after issue. The signature is bound to
   AUTH_SECRET so tokens cannot be forged.
   ────────────────────────────────────────────────────────────── */

export function createMagicLinkToken(): string {
  const expiry = Math.floor(Date.now() / 1000) + MAGIC_LINK_TTL_SECONDS;
  const nonce = randomBytes(16).toString("hex");
  const payload = `${expiry}.${nonce}`;
  const sig = sign(payload);
  return `${payload}.${sig}`;
}

export function verifyMagicLinkToken(token: string | undefined | null): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [expiryStr, nonce, sig] = parts;
  const payload = `${expiryStr}.${nonce}`;
  const expected = sign(payload);
  if (!safeEqualHex(sig, expected)) return false;
  const expiry = parseInt(expiryStr, 10);
  if (!Number.isFinite(expiry)) return false;
  if (Math.floor(Date.now() / 1000) > expiry) return false;
  return true;
}

export const AUTH_COOKIE_NAME = COOKIE_NAME;
export const AUTH_COOKIE_MAX_AGE = SESSION_TTL_SECONDS;
