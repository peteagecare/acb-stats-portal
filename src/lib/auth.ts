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

export interface SessionPayload {
  email: string;
  role: "admin" | "viewer";
}

export function createSessionToken(payload?: SessionPayload): string {
  const issued = Math.floor(Date.now() / 1000);
  const nonce = randomBytes(8).toString("hex");
  const data = payload
    ? `${issued}.${nonce}.${Buffer.from(JSON.stringify(payload)).toString("base64url")}`
    : `${issued}.${nonce}`;
  const sig = sign(data);
  return `${data}.${sig}`;
}

export function verifySessionToken(token: string | undefined): boolean {
  if (!token) return false;
  const parts = token.split(".");
  // Support both old format (3 parts) and new format (4 parts with user data)
  if (parts.length !== 3 && parts.length !== 4) return false;
  const sig = parts[parts.length - 1];
  const payload = parts.slice(0, -1).join(".");
  const expected = sign(payload);
  if (!safeEqualHex(sig, expected)) return false;
  const issued = parseInt(parts[0], 10);
  if (!Number.isFinite(issued)) return false;
  const ageSeconds = Math.floor(Date.now() / 1000) - issued;
  if (ageSeconds < 0 || ageSeconds > SESSION_TTL_SECONDS) return false;
  return true;
}

export function parseSessionToken(token: string | undefined): SessionPayload | null {
  if (!token || !verifySessionToken(token)) return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null; // old format, no user data
  try {
    return JSON.parse(Buffer.from(parts[2], "base64url").toString("utf-8"));
  } catch {
    return null;
  }
}

/* ── Magic-link tokens ─────────────────────────────────────────
   A signed, stateless one-time login token. Encoded as:
     <expiry>.<nonce>.<sig>
   Valid for 15 minutes after issue. The signature is bound to
   AUTH_SECRET so tokens cannot be forged.
   ────────────────────────────────────────────────────────────── */

export function createMagicLinkToken(email?: string): string {
  const expiry = Math.floor(Date.now() / 1000) + MAGIC_LINK_TTL_SECONDS;
  const nonce = randomBytes(16).toString("hex");
  const emailPart = email ? `.${Buffer.from(email).toString("base64url")}` : "";
  const payload = `${expiry}.${nonce}${emailPart}`;
  const sig = sign(payload);
  return `${payload}.${sig}`;
}

export function verifyMagicLinkToken(token: string | undefined | null): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length < 3 || parts.length > 4) return false;
  const sig = parts[parts.length - 1];
  const payload = parts.slice(0, -1).join(".");
  const expected = sign(payload);
  if (!safeEqualHex(sig, expected)) return false;
  const expiry = parseInt(parts[0], 10);
  if (!Number.isFinite(expiry)) return false;
  if (Math.floor(Date.now() / 1000) > expiry) return false;
  return true;
}

export function extractMagicLinkEmail(token: string): string | null {
  const parts = token.split(".");
  // New format: expiry.nonce.emailB64.sig (4 parts)
  if (parts.length !== 4) return null;
  try {
    return Buffer.from(parts[2], "base64url").toString("utf-8");
  } catch {
    return null;
  }
}

export const AUTH_COOKIE_NAME = COOKIE_NAME;
export const AUTH_COOKIE_MAX_AGE = SESSION_TTL_SECONDS;
