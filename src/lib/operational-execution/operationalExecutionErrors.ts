export type OperationalExecutionErrorCode =
  | "not_found"
  | "stale_version"
  | "illegal_transition"
  | "authority_denied"
  | "reason_required"
  | "unknown";

export class OperationalExecutionError extends Error {
  readonly code: OperationalExecutionErrorCode;

  constructor(code: OperationalExecutionErrorCode, message: string) {
    super(message);
    this.name = "OperationalExecutionError";
    this.code = code;
  }
}

export function mapRepositoryError(err: unknown): never {
  if (err instanceof OperationalExecutionError) {
    throw err;
  }
  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();
  if (lower.includes("not found")) {
    throw new OperationalExecutionError("not_found", message);
  }
  if (lower.includes("stale queue version")) {
    throw new OperationalExecutionError("stale_version", message);
  }
  if (lower.includes("cannot ") || lower.includes("illegal_transition")) {
    throw new OperationalExecutionError("illegal_transition", message);
  }
  if (
    lower.includes("denied") ||
    lower.includes("cannot cancel") ||
    lower.includes("not scoped") ||
    lower.includes("forbidden")
  ) {
    throw new OperationalExecutionError("authority_denied", message);
  }
  if (lower.includes("non-empty reason") || lower.includes("requires")) {
    throw new OperationalExecutionError("reason_required", message);
  }
  if (err instanceof Error) {
    throw err;
  }
  throw new OperationalExecutionError("unknown", message);
}

export function requireExecutionReason(reason: string | null | undefined, label: string): void {
  if (!reason?.trim()) {
    throw new OperationalExecutionError("reason_required", `${label} requires a non-empty reason`);
  }
}
