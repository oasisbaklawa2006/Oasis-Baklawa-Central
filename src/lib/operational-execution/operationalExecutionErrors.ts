import { classifyIntegrationError } from "@/lib/integration-contracts";

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

const INTEGRATION_TO_EXECUTION_CODE: Partial<
  Record<ReturnType<typeof classifyIntegrationError>["code"], OperationalExecutionErrorCode>
> = {
  not_found: "not_found",
  stale_version: "stale_version",
  illegal_transition: "illegal_transition",
  authority_denied: "authority_denied",
  forbidden: "authority_denied",
  reason_required: "reason_required",
};

export function mapRepositoryError(err: unknown): never {
  if (err instanceof OperationalExecutionError) {
    throw err;
  }
  const classified = classifyIntegrationError({ err, source: "operational-execution", operation: "write" });
  const mapped = INTEGRATION_TO_EXECUTION_CODE[classified.code];
  if (mapped) {
    throw new OperationalExecutionError(mapped, classified.message);
  }
  if (err instanceof Error) {
    throw err;
  }
  throw new OperationalExecutionError("unknown", classified.message);
}

export function requireExecutionReason(reason: string | null | undefined, label: string): void {
  if (!reason?.trim()) {
    throw new OperationalExecutionError("reason_required", `${label} requires a non-empty reason`);
  }
}
