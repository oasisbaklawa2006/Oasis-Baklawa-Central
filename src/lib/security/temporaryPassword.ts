/** Cryptographically secure, unbiased administrator temporary-password generation. */
const PASSWORD_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";
const PASSWORD_LENGTH = 14;
const ACCEPTABLE_BYTE_LIMIT = 256 - (256 % PASSWORD_CHARS.length);

export function generateTempPassword(): string {
  const bytes = new Uint8Array(PASSWORD_LENGTH);
  let password = "";
  while (password.length < PASSWORD_LENGTH) {
    crypto.getRandomValues(bytes);
    for (const byte of bytes) {
      if (byte >= ACCEPTABLE_BYTE_LIMIT) continue;
      password += PASSWORD_CHARS[byte % PASSWORD_CHARS.length];
      if (password.length === PASSWORD_LENGTH) return password;
    }
  }
  return password;
}
