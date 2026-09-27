import { describe, expect, it } from "vitest";
import {
  buildScopedIdempotencyKey,
  isProvenIdempotentWrite,
  preserveOperatorRetryIdentity,
} from "../idempotency";

describe("idempotency helpers", () => {
  it("builds canonical scoped keys", () => {
    expect(
      buildScopedIdempotencyKey({
        tenant: "co-1",
        source: "central",
        operation: "payment_proof",
        businessReference: "pi-99",
      }),
    ).toBe("co-1:central:payment_proof:pi-99:v1");
  });

  it("preserves operator retry identity", () => {
    const preserved = preserveOperatorRetryIdentity({
      idempotencyKey: " central:retry:1 ",
      correlationId: " corr-1 ",
      source: "central",
      operation: "queue:retry",
    });
    expect(preserved.idempotencyKey).toBe("central:retry:1");
    expect(preserved.correlationId).toBe("corr-1");
  });

  it("rejects operator retry without idempotency key", () => {
    expect(() =>
      preserveOperatorRetryIdentity({
        idempotencyKey: "",
        correlationId: "corr-1",
        source: "central",
        operation: "queue:retry",
      }),
    ).toThrow(/idempotency key/i);
  });

  it("detects proven idempotent writes", () => {
    expect(
      isProvenIdempotentWrite({
        idempotencyKey: "k1",
        correlationId: "c1",
      }),
    ).toBe(true);
    expect(isProvenIdempotentWrite({ idempotencyKey: "k1" })).toBe(false);
  });
});
