import { describe, expect, it } from "vitest";
import { assertOperatorRetryAllowed, formatOperatorRetryDenied } from "../operatorRetry";

const baseCtx = {
  idempotencyKey: "central:queue:retry:item-1",
  correlationId: "corr-abc",
  source: "central",
  operation: "queue:retry",
  actorUserId: "user-1",
  actorRole: "SUPER_ADMIN",
  queueType: "dispatch_queue" as const,
};

describe("assertOperatorRetryAllowed", () => {
  it("allows authorized operator retry with preserved identity", () => {
    expect(() => assertOperatorRetryAllowed("queue:complete", baseCtx)).not.toThrow();
  });

  it("denies unauthorized role for queue cancel", () => {
    expect(() =>
      assertOperatorRetryAllowed("queue:cancel", {
        ...baseCtx,
        actorRole: "VIEWER",
        queueType: "dispatch_queue",
      }),
    ).toThrow(/scoped|denied/i);
  });

  it("denies sensitive retry without AAL2 step-up", () => {
    expect(() =>
      assertOperatorRetryAllowed("queue:retry", {
        ...baseCtx,
        actorRole: "OPERATIONS_MANAGER",
        stepUpVerified: false,
      }),
    ).toThrow(/step-up/i);
  });

  it("allows sensitive retry when step-up verified", () => {
    expect(() =>
      assertOperatorRetryAllowed("queue:retry", {
        ...baseCtx,
        actorRole: "OPERATIONS_MANAGER",
        stepUpVerified: true,
      }),
    ).not.toThrow();
  });

  it("rejects retry without idempotency key", () => {
    expect(() =>
      assertOperatorRetryAllowed("queue:complete", {
        ...baseCtx,
        idempotencyKey: "",
      }),
    ).toThrow(/idempotency key/i);
  });
});

describe("formatOperatorRetryDenied", () => {
  it("returns safe denial message for authority errors", () => {
    expect(
      formatOperatorRetryDenied(new Error("Role STORE_INCHARGE not scoped to queue unknown")),
    ).toMatch(/permission/i);
  });
});
