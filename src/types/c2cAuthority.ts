/**
 * TYPE-ONLY GOVERNANCE SCAFFOLD — NOT ACTIVE.
 *
 * Shared vocabulary for C2C authority, replay, audit, and execution evidence.
 * No runtime wiring. Do not import Supabase, React, or app modules from this file.
 */

/** Escalation / binding strength of an action (design vocabulary). */
export enum C2CAuthorityLevel {
  ReadOnly = "read_only",
  Suggest = "suggest",
  Queue = "queue",
  Execute = "execute",
  Override = "override",
}

/** Lifecycle of replay handling for a logical operation (design vocabulary). */
export enum C2CReplayState {
  None = "none",
  Received = "received",
  Accepted = "accepted",
  DuplicateSuppressed = "duplicate_suppressed",
  Rejected = "rejected",
  Expired = "expired",
}

/** Dry-run aggregate states (aligns with dry-run docs; not enforced at runtime here). */
export enum C2CDryRunState {
  Received = "dryrun_received",
  Validated = "dryrun_validated",
  Queued = "dryrun_queued",
  AuditWritten = "dryrun_audit_written",
  MockSent = "dryrun_mock_sent",
  RetrySimulated = "dryrun_retry_simulated",
  RollbackSimulated = "dryrun_rollback_simulated",
  Completed = "dryrun_completed",
  Failed = "dryrun_failed",
  Aborted = "dryrun_aborted",
}

/** Simulated audit envelope kinds (append-only intent). */
export enum C2CAuditEventType {
  IntentRecorded = "intent_recorded",
  ValidationResult = "validation_result",
  QueueEnqueued = "queue_enqueued",
  MockProviderResult = "mock_provider_result",
  RetryAttempt = "retry_attempt",
  RollbackMarked = "rollback_marked",
  Completion = "completion",
  Failure = "failure",
}

/** Rollback / compensation phase (design). */
export enum C2CRollbackState {
  NotStarted = "not_started",
  InProgress = "in_progress",
  Completed = "completed",
  Failed = "failed",
  AlreadyApplied = "already_applied",
}

/** Queue job lifecycle (design; no queue runs from this file). */
export enum C2CQueueState {
  Disabled = "disabled",
  Pending = "pending",
  Leased = "leased",
  Processing = "processing",
  Completed = "completed",
  DeadLetter = "dead_letter",
  Cancelled = "cancelled",
}

/** What an operator UI may propose vs execute (capability matrix keys). */
export interface C2COperatorCapabilityDescriptor {
  readonly key: string;
  readonly label: string;
  readonly maxAuthority: C2CAuthorityLevel;
  readonly requiresAudit: boolean;
  readonly requiresIdempotencyKey: boolean;
  readonly requiresPacketLock: boolean;
}

/** Evidence bundle maturity for a gate (design). */
export enum C2CExecutionEvidenceState {
  Missing = "missing",
  Planned = "planned",
  Attached = "attached",
  Verified = "verified",
  Stale = "stale",
}

/** Readonly placeholder descriptors — not used by runtime in this scaffold. */
export const C2C_OPERATOR_CAPABILITY_PLACEHOLDERS = [
  {
    key: "operator_reply",
    label: "Operator reply",
    maxAuthority: C2CAuthorityLevel.Execute,
    requiresAudit: true,
    requiresIdempotencyKey: true,
    requiresPacketLock: true,
  },
  {
    key: "classify_intent",
    label: "Classify intent (suggest)",
    maxAuthority: C2CAuthorityLevel.Suggest,
    requiresAudit: false,
    requiresIdempotencyKey: false,
    requiresPacketLock: false,
  },
  {
    key: "route_packet",
    label: "Route packet (suggest)",
    maxAuthority: C2CAuthorityLevel.Suggest,
    requiresAudit: false,
    requiresIdempotencyKey: false,
    requiresPacketLock: false,
  },
] as const satisfies readonly C2COperatorCapabilityDescriptor[];
