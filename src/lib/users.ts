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
 * Load users list. If no users exist yet, seed with Pete as admin
 * using the existing TOTP_SECRET env var.
 */
export async function loadUsers(): Promise<AppUser[]> {
  const users = await loadJson<AppUser[]>(KEY, FALLBACK, []);
  if (users.length === 0) {
    // Seed admin user with the existing env TOTP secret
    const secret = process.env.TOTP_SECRET;
    if (secret) {
      const admin: AppUser = {
        email: ADMIN_EMAIL,
        label: "Pete",
        role: "admin",
        totpSecret: secret,
        createdAt: new Date().toISOString(),
      };
      await saveJson(KEY, FALLBACK, [admin]);
      return [admin];
    }
  }
  return users;
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
