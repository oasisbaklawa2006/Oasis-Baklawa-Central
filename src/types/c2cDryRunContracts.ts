/**
 * TYPE-ONLY dry-run / staging contract shapes — NOT ACTIVE.
 * No fetches, no Supabase, no writes. For future implementation alignment only.
 */

import type {
  C2CAuditEventType,
  C2CAuthorityLevel,
  C2CDryRunState,
  C2CReplayState,
} from "./c2cAuthority";

/** Minimal packet identity for dry-run proposals (no DB row implied). */
export interface C2CDryRunPacketRef {
  readonly packetId: string;
  readonly contactId: string;
  readonly phoneE164: string;
}

/** Dedupe / replay key material carried with a dry-run attempt (design). */
export interface C2CDryRunReplayRecord {
  readonly idempotencyKey: string;
  readonly replayNonce: string;
  readonly replayTtlSeconds: number;
  readonly state: C2CReplayState;
}

/** Single append-only audit envelope (design). */
export interface C2CDryRunAuditEnvelope {
  readonly correlationId: string;
  readonly eventType: C2CAuditEventType;
  readonly occurredAtIso: string;
  readonly payloadSha256: string;
  readonly actorSubject: string | null;
}

/** Point-in-time snapshot of simulated queue depth (design). */
export interface C2CDryRunQueueSnapshot {
  readonly correlationId: string;
  readonly depth: number;
  readonly oldestEnqueuedAtIso: string | null;
}

/** Operator-originated proposal — authority not granted here. */
export interface C2CDryRunOperatorActionProposal {
  readonly proposalId: string;
  readonly packet: C2CDryRunPacketRef;
  readonly proposedAuthority: C2CAuthorityLevel;
  readonly bodyPreviewSha256: string;
  readonly createdAtIso: string;
}

/** Single observability event emitted by a dry-run stage (design). */
export interface C2CDryRunObservabilityEvent {
  readonly correlationId: string;
  readonly stage: string;
  readonly dryRunState: C2CDryRunState;
  readonly durationMs: number;
  readonly attributes: Readonly<Record<string, string | number | boolean>>;
}
