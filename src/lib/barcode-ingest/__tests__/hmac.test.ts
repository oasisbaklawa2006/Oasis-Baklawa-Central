import { describe, expect, it } from "vitest";
import {
  computeHmacSha256Hex,
  constantTimeEqual,
  resolveSigningSecret,
  verifyHmacSignature,
} from "@/lib/barcode-ingest";

describe("hmac", () => {
  const secret = "test-signing-secret";
  const body = JSON.stringify({
    source_app: "barcode_app",
    order_id: "11111111-1111-4111-8111-111111111111",
    order_number: "SO-2026-000136",
  });

  it("computes deterministic HMAC-SHA256 hex", async () => {
    const first = await computeHmacSha256Hex(body, secret);
    const second = await computeHmacSha256Hex(body, secret);
    expect(first).toMatch(/^[0-9a-f]{64}$/i);
    expect(first).toBe(second);
  });

  it("verifies valid signature", async () => {
    const signature = await computeHmacSha256Hex(body, secret);
    const result = await verifyHmacSignature({
      body,
      signatureHeader: signature,
      secret,
    });
    expect(result).toEqual({ ok: true, reason: null });
  });

  it("accepts sha256= prefixed signature header", async () => {
    const signature = await computeHmacSha256Hex(body, secret);
    const result = await verifyHmacSignature({
      body,
      signatureHeader: `sha256=${signature}`,
      secret,
    });
    expect(result.ok).toBe(true);
  });

  it("rejects bad signature", async () => {
    const result = await verifyHmacSignature({
      body,
      signatureHeader: "deadbeef".repeat(8),
      secret,
    });
    expect(result).toEqual({ ok: false, reason: "signature_invalid" });
  });

  it("rejects missing signature", async () => {
    const result = await verifyHmacSignature({
      body,
      signatureHeader: "",
      secret,
    });
    expect(result).toEqual({ ok: false, reason: "signature_missing" });
  });

  it("rejects missing secret", async () => {
    const result = await verifyHmacSignature({
      body,
      signatureHeader: "abc123",
      secret: null,
    });
    expect(result).toEqual({ ok: false, reason: "signing_secret_missing" });
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
