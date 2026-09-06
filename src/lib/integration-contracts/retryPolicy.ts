import { classifyIntegrationError, IntegrationError } from "./integrationError";

/** Bounded auto-retry defaults — Point 10 §11 aligned. */
export const MAX_READ_RETRY_ATTEMPTS = 5;
export const MAX_IDEMPOTENT_WRITE_RETRY_ATTEMPTS = 3;
export const MAX_BACKOFF_MS = 30_000;
export const BASE_BACKOFF_MS = 1_000;

export interface RetryContext {
  attempt: number;
  operation: "read" | "write";
  idempotencyKey?: string | null;
  correlationId?: string | null;
}

export interface RetryDecision {
  shouldRetry: boolean;
  delayMs: number;
  reason?: string;
}

function runtimeJitterMs(): number {
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] % BASE_BACKOFF_MS;
  }
  return BASE_BACKOFF_MS / 2;
}

/** Deterministic jitter for tests when seed provided; otherwise crypto-backed jitter. */
export function computeBoundedBackoffMs(attempt: number, jitterSeed?: number): number {
  const exponential = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** Math.max(0, attempt - 1));
  const jitter = jitterSeed !== undefined ? jitterSeed % BASE_BACKOFF_MS : runtimeJitterMs();
  return Math.min(MAX_BACKOFF_MS, exponential + jitter);
}

export function maxAttemptsForContext(ctx: RetryContext): number {
  if (ctx.operation === "read") return MAX_READ_RETRY_ATTEMPTS;
  if (ctx.idempotencyKey?.trim()) return MAX_IDEMPOTENT_WRITE_RETRY_ATTEMPTS;
  return 0;
}

/**
 * Auto-retry is permitted only for transient failures.
 * Non-idempotent writes must not auto-retry (Point 11 delegation).
 */
export function evaluateRetryDecision(err: unknown, ctx: RetryContext): RetryDecision {
  const classified = classifyIntegrationError({
    err,
    operation: ctx.operation,
  });

  if (classified.failureClass === "unavailable") {
    return { shouldRetry: false, delayMs: 0, reason: "authority_unavailable" };
  }

  if (!classified.retryable) {
    return { shouldRetry: false, delayMs: 0, reason: classified.code };
  }

  if (ctx.operation === "write" && !ctx.idempotencyKey?.trim()) {
    return { shouldRetry: false, delayMs: 0, reason: "idempotency_required_for_write_retry" };
  }

  const maxAttempts = maxAttemptsForContext(ctx);
  if (ctx.attempt >= maxAttempts) {
    return { shouldRetry: false, delayMs: 0, reason: "retry_budget_exhausted" };
  }

  return {
    shouldRetry: true,
    delayMs: computeBoundedBackoffMs(ctx.attempt),
  };
}

export async function withBoundedRetry<T>(
  fn: () => Promise<T>,
  ctx: Omit<RetryContext, "attempt">,
): Promise<T> {
  let attempt = 0;

  while (true) {
    try {
      return await fn();
    } catch (err) {
      attempt += 1;
      const decision = evaluateRetryDecision(err, { ...ctx, attempt });
      if (!decision.shouldRetry) {
        throw err instanceof IntegrationError ? err : classifyIntegrationError({ err, operation: ctx.operation });
      }
      await new Promise((resolve) => setTimeout(resolve, decision.delayMs));
    }
  }
}
