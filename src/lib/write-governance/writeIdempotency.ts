import type { WriteActionKind } from "./writeActionKinds";

export interface WriteIdempotencyInput {
  kind: WriteActionKind;
  /** Stable entity scope (e.g. storeId|draftFingerprint). */
  scopeKey: string;
  /** Actor identifier when policy requires actor scoping. */
  actorId: string;
  /** Client-supplied correlation id for this intent session (must be stable across retries). */
  correlationId: string;
}

/** Deterministic, retry-stable idempotency token — no randomness. */
export function deriveWriteIdempotencyKey(input: WriteIdempotencyInput): string {
  const normalized = [input.kind, norm(input.scopeKey), norm(input.actorId), norm(input.correlationId)].join("|");
  return `${input.kind}#${fnv1a32(normalized)}`;
}

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Small deterministic hash — no crypto dependency; sufficient for contract tests. */
function fnv1a32(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}
