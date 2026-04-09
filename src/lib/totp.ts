import { createHmac } from "crypto";

/**
 * TOTP (RFC 6238) verification using Node.js crypto.
 * Compatible with Google Authenticator (SHA-1, 6 digits, 30-second step).
 */

const DIGITS = 6;
const STEP = 30; // seconds
const WINDOW = 1; // accept ±1 step for clock drift

function base32Decode(input: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const cleaned = input.replace(/[\s=-]/g, "").toUpperCase();
  let bits = "";
  for (const ch of cleaned) {
    const val = alphabet.indexOf(ch);
    if (val === -1) throw new Error(`Invalid base32 character: ${ch}`);
    bits += val.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

function generateCode(secret: Buffer, counter: bigint): string {
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigUInt64BE(counter);
  const hmac = createHmac("sha1", secret).update(counterBuf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(code % 10 ** DIGITS).padStart(DIGITS, "0");
}

export function verifyTOTP(token: string): boolean {
  const secretB32 = process.env.TOTP_SECRET;
  if (!secretB32) throw new Error("TOTP_SECRET env var is not set");
  const secret = base32Decode(secretB32);
  const now = Math.floor(Date.now() / 1000);
  const currentCounter = BigInt(Math.floor(now / STEP));
  const cleaned = token.replace(/\s/g, "");
  for (let i = -WINDOW; i <= WINDOW; i++) {
    if (generateCode(secret, currentCounter + BigInt(i)) === cleaned) {
      return true;
    }
  }
  return false;
}
