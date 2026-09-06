import { describe, expect, it } from "vitest";
import {
  IntegrationError,
  classifyBarcodeIngestReason,
  classifyIntegrationError,
} from "../integrationError";

describe("classifyIntegrationError", () => {
  it("classifies network failures as transient and retryable", () => {
    const result = classifyIntegrationError({
      err: new Error("fetch failed: network error"),
      operation: "read",
    });
    expect(result.failureClass).toBe("transient");
    expect(result.retryable).toBe(true);
    expect(result.code).toBe("network_error");
  });

  it("classifies stale version as transient", () => {
    const result = classifyIntegrationError({
      err: new Error("stale queue version"),
      operation: "write",
    });
    expect(result.code).toBe("stale_version");
    expect(result.failureClass).toBe("transient");
    expect(result.retryable).toBe(true);
  });

  it("classifies authority denial as permanent", () => {
    const result = classifyIntegrationError({
      err: new Error("Role OPERATOR not scoped to queue dispatch"),
      operation: "write",
    });
    expect(result.code).toBe("authority_denied");
    expect(result.failureClass).toBe("permanent");
    expect(result.retryable).toBe(false);
  });

  it("classifies cannot cancel as authority_denied not illegal_transition", () => {
    const result = classifyIntegrationError({
      err: new Error("Role OPERATOR cannot cancel dispatch"),
      operation: "write",
    });
    expect(result.code).toBe("authority_denied");
    expect(result.failureClass).toBe("permanent");
  });

  it("classifies missing reason before illegal_transition vocabulary", () => {
    const result = classifyIntegrationError({
      err: new Error("Cannot approve without a non-empty reason"),
      operation: "write",
    });
    expect(result.code).toBe("reason_required");
    expect(result.failureClass).toBe("permanent");
  });

  it("classifies connection failures as transient network_error", () => {
    const result = classifyIntegrationError({
      err: new Error("Cannot connect to host"),
      operation: "read",
    });
    expect(result.code).toBe("network_error");
    expect(result.failureClass).toBe("transient");
    expect(result.retryable).toBe(true);
  });

  it("classifies 409 as permanent and non-retryable", () => {
    const result = classifyIntegrationError({
      err: { message: "Conflict", status: 409 },
      operation: "write",
    });
    expect(result.code).toBe("serialization_conflict");
    expect(result.failureClass).toBe("permanent");
    expect(result.retryable).toBe(false);
  });

  it("classifies 404 as permanent not_found", () => {
    const result = classifyIntegrationError({
      err: { message: "Not found", status: 404 },
      operation: "read",
    });
    expect(result.code).toBe("not_found");
    expect(result.failureClass).toBe("permanent");
  });

  it("classifies 503 as transient service_unavailable", () => {
    const result = classifyIntegrationError({
      err: { message: "Service unavailable", status: 503 },
      operation: "read",
    });
    expect(result.code).toBe("service_unavailable");
    expect(result.failureClass).toBe("transient");
    expect(result.retryable).toBe(true);
  });

  it("preserves IntegrationError instances", () => {
    const original = new IntegrationError({
      code: "authority_unavailable",
      failureClass: "unavailable",
      message: "Core unavailable",
      retryable: false,
    });
    expect(classifyIntegrationError({ err: original })).toBe(original);
  });
});

describe("classifyBarcodeIngestReason", () => {
  it("marks validation failures permanent", () => {
    const result = classifyBarcodeIngestReason("barcode_mismatch");
    expect(result.failureClass).toBe("permanent");
    expect(result.retryable).toBe(false);
  });

  it("marks internal_error transient for safe client replay with same idempotency key", () => {
    const result = classifyBarcodeIngestReason("internal_error");
    expect(result.failureClass).toBe("transient");
    expect(result.retryable).toBe(true);
  });
});
