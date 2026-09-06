export {
  IntegrationError,
  classifyIntegrationError,
  classifyBarcodeIngestReason,
  type IntegrationErrorCode,
  type IntegrationFailureClass,
  type IntegrationErrorShape,
  type ClassifyIntegrationErrorInput,
} from "./integrationError";

export {
  MAX_READ_RETRY_ATTEMPTS,
  MAX_IDEMPOTENT_WRITE_RETRY_ATTEMPTS,
  MAX_BACKOFF_MS,
  BASE_BACKOFF_MS,
  computeBoundedBackoffMs,
  evaluateRetryDecision,
  maxAttemptsForContext,
  withBoundedRetry,
  type RetryContext,
  type RetryDecision,
} from "./retryPolicy";

export {
  buildScopedIdempotencyKey,
  preserveOperatorRetryIdentity,
  isProvenIdempotentWrite,
  type IdempotentCommandIdentity,
} from "./idempotency";

export {
  assertOperatorRetryAllowed,
  formatOperatorRetryDenied,
  type OperatorRetryContext,
  type SensitiveOperatorRetryOptions,
} from "./operatorRetry";

export {
  assertAuthorityAvailable,
  isDemoFallbackPermitted,
  isProductionRuntime,
  resolveAuthorityAvailability,
  type AuthorityAvailability,
} from "./unavailableGuard";
