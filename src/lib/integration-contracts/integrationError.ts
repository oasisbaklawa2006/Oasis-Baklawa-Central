/**
 * Central integration error classification contract (Point 24).
 * Domain idempotency remains on Core/backend contracts; this layer classifies
 * transport and adapter failures for bounded retry and operator UX only.
 */

export type IntegrationFailureClass = "transient" | "permanent" | "unavailable";

export type IntegrationErrorCode =
  | "network_error"
  | "timeout"
  | "rate_limited"
  | "serialization_conflict"
  | "service_unavailable"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "validation_error"
  | "business_rule_violation"
  | "stale_version"
  | "illegal_transition"
  | "authority_denied"
  | "authority_unavailable"
  | "reason_required"
  | "unknown";

export interface IntegrationErrorShape {
  code: IntegrationErrorCode;
  failureClass: IntegrationFailureClass;
  message: string;
  retryable: boolean;
  httpStatus?: number;
  source?: string;
}

export class IntegrationError extends Error implements IntegrationErrorShape {
  readonly code: IntegrationErrorCode;
  readonly failureClass: IntegrationFailureClass;
  readonly retryable: boolean;
  readonly httpStatus?: number;
  readonly source?: string;

  constructor(shape: IntegrationErrorShape) {
    super(shape.message);
    this.name = "IntegrationError";
    this.code = shape.code;
    this.failureClass = shape.failureClass;
    this.retryable = shape.retryable;
    this.httpStatus = shape.httpStatus;
    this.source = shape.source;
  }
}

export interface ClassifyIntegrationErrorInput {
  err: unknown;
  source?: string;
  httpStatus?: number;
  operation?: "read" | "write";
}

const TRANSIENT_HTTP = new Set([408, 425, 429, 500, 502, 503, 504]);
const PERMANENT_HTTP = new Set([400, 401, 403, 404, 409, 410, 422]);

function failureClassForCode(code: IntegrationErrorCode): IntegrationFailureClass {
  switch (code) {
    case "network_error":
    case "timeout":
    case "rate_limited":
    case "serialization_conflict":
    case "service_unavailable":
    case "stale_version":
      return "transient";
    case "authority_unavailable":
      return "unavailable";
    default:
      return "permanent";
  }
}

function isRetryable(code: IntegrationErrorCode): boolean {
  return failureClassForCode(code) === "transient";
}

function classifyMessage(lower: string): IntegrationErrorCode | null {
  if (lower.includes("stale queue version") || lower.includes("stale_version")) {
    return "stale_version";
  }
  if (lower.includes("cannot ") || lower.includes("illegal_transition")) {
    return "illegal_transition";
  }
  if (
    lower.includes("denied") ||
    lower.includes("cannot cancel") ||
    lower.includes("not scoped") ||
    lower.includes("forbidden") ||
    lower.includes("authority denied")
  ) {
    return "authority_denied";
  }
  if (lower.includes("non-empty reason") || lower.includes("requires a non-empty reason")) {
    return "reason_required";
  }
  if (lower.includes("not found") || lower.includes("does not exist")) {
    return "not_found";
  }
  if (lower.includes("unauthorized") || lower.includes("jwt") || lower.includes("invalid login")) {
    return "unauthorized";
  }
  if (lower.includes("timeout") || lower.includes("timed out")) {
    return "timeout";
  }
  if (lower.includes("rate limit") || lower.includes("too many requests")) {
    return "rate_limited";
  }
  if (
    lower.includes("serialization") ||
    lower.includes("deadlock") ||
    lower.includes("conflict")
  ) {
    return "serialization_conflict";
  }
  if (
    lower.includes("network") ||
    lower.includes("fetch failed") ||
    lower.includes("failed to fetch") ||
    lower.includes("econnreset")
  ) {
    return "network_error";
  }
  if (
    lower.includes("unavailable") ||
    lower.includes("service unavailable") ||
    lower.includes("maintenance")
  ) {
    return "service_unavailable";
  }
  if (lower.includes("validation") || lower.includes("invalid ")) {
    return "validation_error";
  }
  if (lower.includes("business rule") || lower.includes("violated")) {
    return "business_rule_violation";
  }
  return null;
}

function classifyHttpStatus(status: number): IntegrationErrorCode {
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 408) return "timeout";
  if (status === 409) return "serialization_conflict";
  if (status === 422) return "validation_error";
  if (status === 429) return "rate_limited";
  if (status === 503) return "service_unavailable";
  if (status >= 500) return "service_unavailable";
  if (status >= 400) return "validation_error";
  return "unknown";
}

function extractMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err !== null && "message" in err) {
    return String((err as { message: unknown }).message);
  }
  return String(err);
}

function extractHttpStatus(err: unknown, override?: number): number | undefined {
  if (override !== undefined) return override;
  if (typeof err === "object" && err !== null) {
    const candidate = err as { status?: number; statusCode?: number };
    if (typeof candidate.status === "number") return candidate.status;
    if (typeof candidate.statusCode === "number") return candidate.statusCode;
  }
  return undefined;
}

/** Maps adapter/transport errors to explicit transient/permanent/unavailable classes. */
export function classifyIntegrationError(input: ClassifyIntegrationErrorInput): IntegrationError {
  const { err, source, operation } = input;
  const httpStatus = extractHttpStatus(err, input.httpStatus);
  const message = extractMessage(err);
  const lower = message.toLowerCase();

  if (err instanceof IntegrationError) {
    return err;
  }

  let code: IntegrationErrorCode = classifyMessage(lower) ?? "unknown";

  if (code === "unknown" && httpStatus !== undefined) {
    code = classifyHttpStatus(httpStatus);
  }

  if (
    code === "unknown" &&
    operation === "read" &&
    (lower.includes("failed") || lower.includes("error"))
  ) {
    code = "network_error";
  }

  const failureClass = failureClassForCode(code);
  const retryable = isRetryable(code);

  if (httpStatus !== undefined && PERMANENT_HTTP.has(httpStatus) && code === "unknown") {
    return new IntegrationError({
      code: classifyHttpStatus(httpStatus),
      failureClass: "permanent",
      message,
      retryable: false,
      httpStatus,
      source,
    });
  }

  if (httpStatus !== undefined && TRANSIENT_HTTP.has(httpStatus) && failureClass === "permanent") {
    return new IntegrationError({
      code: classifyHttpStatus(httpStatus),
      failureClass: "transient",
      message,
      retryable: true,
      httpStatus,
      source,
    });
  }

  return new IntegrationError({
    code,
    failureClass,
    message,
    retryable,
    httpStatus,
    source,
  });
}

/** Barcode ingest reason codes → integration classification (edge contract). */
export function classifyBarcodeIngestReason(reason: string): IntegrationError {
  const permanentReasons = new Set([
    "missing_idempotency_key",
    "invalid_signature",
    "invalid_payload",
    "order_not_found",
    "barcode_mismatch",
    "unsupported_scan_type",
    "unauthorized_source",
  ]);
  if (permanentReasons.has(reason)) {
    return new IntegrationError({
      code: reason === "unauthorized_source" ? "unauthorized" : "validation_error",
      failureClass: "permanent",
      message: reason,
      retryable: false,
      source: "barcode-scan-ingest",
    });
  }
  return new IntegrationError({
    code: "service_unavailable",
    failureClass: "transient",
    message: reason,
    retryable: true,
    httpStatus: 503,
    source: "barcode-scan-ingest",
  });
}
