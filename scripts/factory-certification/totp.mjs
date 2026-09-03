import { createHmac } from "node:crypto";

/**
 * Decode a base32 (RFC 4648) secret into raw bytes, as returned by Supabase
 * Auth's MFA TOTP enrollment response (`data.totp.secret`).
 *
 * @param {string} base32Secret
 * @returns {Buffer}
 */
function decodeBase32(base32Secret) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const char of base32Secret.toUpperCase().replaceAll("=", "")) {
    const value = alphabet.indexOf(char);
    if (value === -1) continue;
    bits += value.toString(2).padStart(5, "0");
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

/**
 * Compute an RFC 6238 TOTP code (30s step, 6 digits, HMAC-SHA1 -- Supabase
 * Auth's TOTP enrollment defaults) for a base32 secret, at a given instant.
 * The single shared implementation for both the Node-side certification
 * bootstrap (create-test-identities.mjs, via local-supabase-client.mjs) and
 * the Playwright runtime step-up flow (tests/factory-certification/support.ts)
 * -- both must compute codes from the SAME enrolled factor, never a
 * stored/replayed one.
 *
 * @param {string} base32Secret the `totp.secret` from `auth.mfa.enroll()`
 * @param {number} [atTimeMs] instant to compute the code for, default now
 * @returns {string} 6-digit TOTP code
 */
export function computeTotpCode(base32Secret, atTimeMs = Date.now()) {
  const key = decodeBase32(base32Secret);
  const counter = Math.floor(Math.floor(atTimeMs / 1000) / 30);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", key).update(counterBuffer).digest();
  const offset = hmac.readUInt8(hmac.length - 1) & 0x0f;
  const binaryCode = hmac.readUInt32BE(offset) & 0x7fffffff;
  return String(binaryCode % 1_000_000).padStart(6, "0");
}
