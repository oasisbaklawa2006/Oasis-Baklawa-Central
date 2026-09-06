import { describe, expect, it } from "vitest";
import { IntegrationError } from "../integrationError";
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
    ).toThrow(IntegrationError);
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

  it("maps finance retry to approved queue:start authority action", () => {
    expect(() =>
      assertOperatorRetryAllowed("finance:retry", {
        ...baseCtx,
        actorRole: "FINANCE_HEAD",
        queueType: "finance_review_queue",
        stepUpVerified: true,
      }),
    ).not.toThrow();
  });

  it("maps dispatch retry to approved queue:start authority action", () => {
    expect(() =>
      assertOperatorRetryAllowed("dispatch:retry", {
        ...baseCtx,
        actorRole: "DISPATCH_MANAGER",
        queueType: "dispatch_queue",
        stepUpVerified: true,
      }),
    ).not.toThrow();
  });
});

describe("formatOperatorRetryDenied", () => {
  it("returns safe denial message for authority errors", () => {
    expect(
      formatOperatorRetryDenied(new Error("Role STORE_INCHARGE not scoped to queue unknown")),
    ).toMatch(/permission/i);
  });

  it("returns authentication message for AAL2 step-up denial", () => {
    expect(
      formatOperatorRetryDenied(
        new IntegrationError({
          code: "unauthorized",
          failureClass: "permanent",
          message: "Step-up authentication (AAL2) required for operator retry",
          retryable: false,
          source: "operator-retry",
        }),
      ),
    ).toMatch(/authentication required/i);
  });
});
