import { describe, expect, it } from "vitest";
import {
  IntegrationError,
  MAX_READ_RETRY_ATTEMPTS,
  computeBoundedBackoffMs,
  evaluateRetryDecision,
} from "../index";

describe("evaluateRetryDecision", () => {
  it("allows bounded read retries for transient errors", () => {
    const decision = evaluateRetryDecision(new Error("fetch failed"), {
      attempt: 1,
      operation: "read",
    });
    expect(decision.shouldRetry).toBe(true);
    expect(decision.delayMs).toBeGreaterThan(0);
  });

  it("denies auto-retry for non-idempotent writes", () => {
    const decision = evaluateRetryDecision(new Error("timeout"), {
      attempt: 1,
      operation: "write",
    });
    expect(decision.shouldRetry).toBe(false);
    expect(decision.reason).toBe("idempotency_required_for_write_retry");
  });

  it("allows bounded idempotent write retries", () => {
    const decision = evaluateRetryDecision(new Error("service unavailable"), {
      attempt: 1,
      operation: "write",
      idempotencyKey: "central:pf6a:order:123:v1",
      correlationId: "corr-1",
    });
    expect(decision.shouldRetry).toBe(true);
  });

  it("stops after retry budget exhausted", () => {
    const decision = evaluateRetryDecision(new Error("network error"), {
      attempt: MAX_READ_RETRY_ATTEMPTS,
      operation: "read",
    });
    expect(decision.shouldRetry).toBe(false);
    expect(decision.reason).toBe("retry_budget_exhausted");
  });

  it("denies retry for permanent business rule violations", () => {
    const decision = evaluateRetryDecision(new Error("business rule violated"), {
      attempt: 1,
      operation: "read",
    });
    expect(decision.shouldRetry).toBe(false);
    expect(decision.reason).toBe("business_rule_violation");
  });

  it("denies retry when authority unavailable", () => {
    const decision = evaluateRetryDecision(
      new IntegrationError({
        code: "authority_unavailable",
        failureClass: "unavailable",
        message: "unavailable",
        retryable: false,
      }),
      { attempt: 1, operation: "read" },
    );
    expect(decision.shouldRetry).toBe(false);
    expect(decision.reason).toBe("authority_unavailable");
  });
});

describe("computeBoundedBackoffMs", () => {
  it("uses deterministic jitter when seed provided", () => {
    expect(computeBoundedBackoffMs(1, 250)).toBe(1250);
    expect(computeBoundedBackoffMs(2, 100)).toBe(2100);
  });

  it("caps backoff at MAX_BACKOFF_MS", () => {
    expect(computeBoundedBackoffMs(20, 0)).toBeLessThanOrEqual(30_000);
  });
});
