/**
 * NON-RUNTIME MOCK FIXTURES — NOT CONNECTED TO APPLICATION.
 *
 * Readonly literal fixtures for tests and documentation examples only.
 * No functions, no async, no fetches, no imports from app or Supabase.
 */

import {
  C2CAuditEventType,
  C2CAuthorityLevel,
  C2CDryRunState,
  C2CQueueState,
  C2CReplayState,
  C2CRollbackState,
} from "./c2cAuthority";

export const C2C_MOCK_REPLAY_STATES_ORDERED = [
  C2CReplayState.Received,
  C2CReplayState.Accepted,
  C2CReplayState.DuplicateSuppressed,
] as const;

export const C2C_MOCK_AUDIT_EVENTS_SEQUENCE = [
  {
    correlationId: "00000000-0000-4000-8000-000000000001",
    eventType: C2CAuditEventType.IntentRecorded,
    occurredAtIso: "2026-05-23T00:00:00.000Z",
    payloadSha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    actorSubject: "staging-operator-synthetic-001",
  },
  {
    correlationId: "00000000-0000-4000-8000-000000000001",
    eventType: C2CAuditEventType.ValidationResult,
    occurredAtIso: "2026-05-23T00:00:00.010Z",
    payloadSha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    actorSubject: "staging-operator-synthetic-001",
  },
] as const;

export const C2C_MOCK_DRY_RUN_PACKET = {
  packetId: "00000000-0000-4000-8000-0000000000a1",
  contactId: "00000000-0000-4000-8000-0000000000b2",
  phoneE164: "+15550000001",
} as const;

export const C2C_MOCK_QUEUE_SNAPSHOT = {
  correlationId: "00000000-0000-4000-8000-000000000001",
  depth: 0,
  oldestEnqueuedAtIso: null as string | null,
  logicalQueueState: C2CQueueState.Disabled,
} as const;

export const C2C_MOCK_OPERATOR_PROPOSAL = {
  proposalId: "00000000-0000-4000-8000-0000000000c3",
  packet: C2C_MOCK_DRY_RUN_PACKET,
  proposedAuthority: C2CAuthorityLevel.Execute,
  bodyPreviewSha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  createdAtIso: "2026-05-23T00:00:00.020Z",
} as const;

export const C2C_MOCK_ROLLBACK_STATE = C2CRollbackState.Completed;

export const C2C_MOCK_DRY_RUN_STATE_SEQUENCE = [
  C2CDryRunState.Received,
  C2CDryRunState.Validated,
  C2CDryRunState.Queued,
  C2CDryRunState.AuditWritten,
  C2CDryRunState.MockSent,
  C2CDryRunState.Completed,
] as const;
