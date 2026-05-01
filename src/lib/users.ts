import { loadJson, saveJson } from "@/lib/blob-store";
import { randomBytes } from "crypto";

const KEY = "users.json";
const FALLBACK = "./users.json";

const ADMIN_EMAIL = "pete@agecare-bathrooms.co.uk";

export interface AppUser {
  email: string;
  label: string; // display name
  role: "admin" | "viewer";
  totpSecret: string; // base32
  createdAt: string; // ISO date
}

/**
 * Load users list. Returns an admin Pete fallback in memory if the directory
 * is empty, but DOES NOT persist that fallback — historically that auto-save
 * would silently wipe the directory whenever a transient blob read failed.
 * Use `seedAdminIfMissing()` deliberately when you actually want to write.
 */
export async function loadUsers(): Promise<AppUser[]> {
  const users = await loadJson<AppUser[]>(KEY, FALLBACK, []);
  if (users.length > 0) return users;

  const secret = process.env.TOTP_SECRET;
  if (!secret) return [];
  // In-memory fallback only — never written.
  return [
    {
      email: ADMIN_EMAIL,
      label: "Pete",
      role: "admin",
      totpSecret: secret,
      createdAt: new Date().toISOString(),
    },
  ];
}

/** Explicit seed — only call from a deliberate admin-bootstrap path. */
export async function seedAdminIfMissing(): Promise<void> {
  const users = await loadJson<AppUser[]>(KEY, FALLBACK, []);
  if (users.length > 0) return;
  const secret = process.env.TOTP_SECRET;
  if (!secret) return;
  const admin: AppUser = {
    email: ADMIN_EMAIL,
    label: "Pete",
    role: "admin",
    totpSecret: secret,
    createdAt: new Date().toISOString(),
  };
  await saveJson(KEY, FALLBACK, [admin]);
}

export async function saveUsers(users: AppUser[]): Promise<void> {
  await saveJson(KEY, FALLBACK, users);
}

export function isAdmin(email: string): boolean {
  return email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
}

/**
 * Generate a random base32 TOTP secret (20 bytes = 160 bits, standard for Google Authenticator)
 */
export function generateTotpSecret(): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bytes = randomBytes(20);
  let result = "";
  let bits = 0;
  let value = 0;
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      result += alphabet[(value >> bits) & 0x1f];
    }
  }
  if (bits > 0) {
    result += alphabet[(value << (5 - bits)) & 0x1f];
  }
  return result;
}
