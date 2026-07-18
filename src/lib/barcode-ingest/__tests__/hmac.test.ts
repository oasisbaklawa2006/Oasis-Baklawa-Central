import { describe, expect, it } from "vitest";
import {
  buildBarcodeScanSignedMessage,
  computeHmacSha256Hex,
  constantTimeEqual,
  resolveIngestHttpStatus,
  resolveSigningSecret,
  verifyHmacSignature,
} from "@/lib/barcode-ingest";

describe("hmac", () => {
  const secret = "test-signing-secret";
  const idempotencyKey = "scan:order-1:carton-1";
  const body = JSON.stringify({
    source_app: "barcode_app",
    order_id: "11111111-1111-4111-8111-111111111111",
    order_number: "SO-2026-000136",
  });
  const signedMessage = buildBarcodeScanSignedMessage(idempotencyKey, body);

  it("computes deterministic HMAC-SHA256 hex", async () => {
    const first = await computeHmacSha256Hex(signedMessage, secret);
    const second = await computeHmacSha256Hex(signedMessage, secret);
    expect(first).toMatch(/^[0-9a-f]{64}$/i);
    expect(first).toBe(second);
  });

  it("verifies valid signature", async () => {
    const signature = await computeHmacSha256Hex(signedMessage, secret);
    const result = await verifyHmacSignature({
      body,
      idempotencyKey,
      signatureHeader: signature,
      secret,
    });
    expect(result).toEqual({ ok: true, reason: null });
  });

  it("accepts sha256= prefixed signature header", async () => {
    const signature = await computeHmacSha256Hex(signedMessage, secret);
    const result = await verifyHmacSignature({
      body,
      idempotencyKey,
      signatureHeader: `sha256=${signature}`,
      secret,
    });
    expect(result.ok).toBe(true);
  });

  it("rejects a signature replayed with a different idempotency key", async () => {
    const signature = await computeHmacSha256Hex(signedMessage, secret);
    const result = await verifyHmacSignature({
      body,
      idempotencyKey: "scan:order-1:carton-2",
      signatureHeader: signature,
      secret,
    });
    expect(result).toEqual({ ok: false, reason: "signature_invalid" });
  });

  it("rejects bad signature", async () => {
    const result = await verifyHmacSignature({
      body,
      idempotencyKey,
      signatureHeader: "deadbeef".repeat(8),
      secret,
    });
    expect(result).toEqual({ ok: false, reason: "signature_invalid" });
    expect(resolveIngestHttpStatus("signature_invalid")).toBe(401);
  });

  it("rejects missing signature", async () => {
    const result = await verifyHmacSignature({
      body,
      idempotencyKey,
      signatureHeader: "",
      secret,
    });
    expect(result).toEqual({ ok: false, reason: "signature_missing" });
    expect(resolveIngestHttpStatus("signature_missing")).toBe(401);
  });

  it("rejects missing secret", async () => {
    const result = await verifyHmacSignature({
      body,
      idempotencyKey,
      signatureHeader: "abc123",
      secret: null,
    });
    expect(result).toEqual({ ok: false, reason: "signing_secret_missing" });
  });

  it("rejects missing idempotency key when the ingress contract requires it", async () => {
    const result = await verifyHmacSignature({
      body,
      idempotencyKey: "",
      requireIdempotencyKey: true,
      signatureHeader: "abc123",
      secret,
    });
    expect(result).toEqual({ ok: false, reason: "missing_idempotency_key" });
  });

  it("resolves primary secret before alias", () => {
    expect(
      resolveSigningSecret({
        BARCODE_APP_SCAN_SIGNING_SECRET: "primary",
        CENTRAL_SCAN_SIGNING_SECRET: "alias",
      }),
    ).toBe("primary");
  });

  it("falls back to alias secret", () => {
    expect(
      resolveSigningSecret({
        CENTRAL_SCAN_SIGNING_SECRET: "alias-only",
      }),
    ).toBe("alias-only");
  });

  it("uses constant-time comparison", () => {
    expect(constantTimeEqual("abc", "abc")).toBe(true);
    expect(constantTimeEqual("abc", "abd")).toBe(false);
    expect(constantTimeEqual("abc", "ab")).toBe(false);
  });
});
