/**
 * Central idempotency helpers — delegates canonical key semantics to Core contracts.
 * Keys must be stable across operator retries (Point 11).
 */

export interface IdempotentCommandIdentity {
  idempotencyKey: string;
  correlationId: string;
  commandId?: string;
  source: string;
  operation: string;
}

export function buildScopedIdempotencyKey(parts: {
  tenant?: string;
  source: string;
  operation: string;
  businessReference: string;
  intentVersion?: string;
}): string {
  const tenant = parts.tenant?.trim() || "global";
  const intent = parts.intentVersion?.trim() || "v1";
  return `${tenant}:${parts.source}:${parts.operation}:${parts.businessReference}:${intent}`;
}

/** Preserves original command identity for governed operator retry. */
export function preserveOperatorRetryIdentity<T extends IdempotentCommandIdentity>(
  original: T,
): T {
  if (!original.idempotencyKey?.trim()) {
    throw new Error("Operator retry requires a preserved idempotency key");
  }
  if (!original.correlationId?.trim()) {
    throw new Error("Operator retry requires a preserved correlation id");
  }
  return {
    ...original,
    idempotencyKey: original.idempotencyKey.trim(),
    correlationId: original.correlationId.trim(),
  };
}

export function isProvenIdempotentWrite(identity: Partial<IdempotentCommandIdentity>): boolean {
  return Boolean(identity.idempotencyKey?.trim() && identity.correlationId?.trim());
}
