/** HMAC-SHA256 verification for Barcode App scan ingest requests. */

const encoder = new TextEncoder();

export function resolveSigningSecret(env: {
  BARCODE_APP_SCAN_SIGNING_SECRET?: string;
  CENTRAL_SCAN_SIGNING_SECRET?: string;
}): string | null {
  const primary = env.BARCODE_APP_SCAN_SIGNING_SECRET?.trim();
  if (primary) return primary;
  const alias = env.CENTRAL_SCAN_SIGNING_SECRET?.trim();
  return alias || null;
}

export function buildBarcodeScanSignedMessage(idempotencyKey: string, body: string): string {
  return `${idempotencyKey.trim()}\n${body}`;
}

export async function computeHmacSha256Hex(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function constantTimeEqual(a: string, b: string): boolean {
  const left = a.trim();
  const right = b.trim();
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let i = 0; i < left.length; i++) {
    mismatch |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return mismatch === 0;
}

export function normalizeSignatureHeader(signature: string): string {
  const trimmed = signature.trim();
  const sha256Prefix = /^sha256=/i;
  if (sha256Prefix.test(trimmed)) {
    return trimmed.replace(sha256Prefix, "").trim();
  }
  return trimmed;
}

export interface HmacVerificationResult {
  ok: boolean;
  reason: string | null;
}

export async function verifyHmacSignature(input: {
  body: string;
  idempotencyKey?: string;
  signatureHeader: string | null | undefined;
  secret: string | null | undefined;
}): Promise<HmacVerificationResult> {
  if (!input.secret?.trim()) {
    return { ok: false, reason: "signing_secret_missing" };
  }
  if (!input.signatureHeader?.trim()) {
    return { ok: false, reason: "signature_missing" };
  }

  const idempotencyKey = input.idempotencyKey?.trim() ?? "";
  if (!idempotencyKey) {
    return { ok: false, reason: "missing_idempotency_key" };
  }

  const provided = normalizeSignatureHeader(input.signatureHeader);
  const signedMessage = buildBarcodeScanSignedMessage(idempotencyKey, input.body);
  const expected = await computeHmacSha256Hex(signedMessage, input.secret);
  if (!constantTimeEqual(provided.toLowerCase(), expected.toLowerCase())) {
    return { ok: false, reason: "signature_invalid" };
  }
  return { ok: true, reason: null };
}
