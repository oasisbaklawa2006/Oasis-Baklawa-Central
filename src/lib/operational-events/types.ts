/**
 * Unified operational event model (Phase A — read-only / client-derived).
 * Append-only semantics at the persistence layer are a future concern; this module
 * only normalizes in-memory feeds for UI. Never invent authoritative timestamps.
 */

export type OperationalEventCategory =
  | "operational"
  | "financial"
  | "communication"
  | "escalation"
  | "dispatch"
  | "support"
  | "audit";

/** Priority for notification-style surfaces (Phase F); safe default info. */
export type OperationalEventSeverity = "info" | "warning" | "urgent" | "critical";

export type OperationalActorRole =
  | "system"
  | "operator"
  | "customer"
  | "finance"
  | "dispatch"
  | "production"
  | "store"
  | "cmd"
  | "unknown";

export interface OperationalEventActor {
  role: OperationalActorRole;
  /** Non-sensitive display label only */
  displayLabel?: string;
}

export type OperationalEntityType =
  | "order"
  | "whatsapp_packet"
  | "invoice"
  | "ticket"
  | "requisition"
  | "production_job"
  | "approval";

export interface OperationalEntityRef {
  entityType: OperationalEntityType;
  id: string;
}

/** Where this row came from — never claim DB audit trail unless source says so */
export type OperationalEventSource =
  | "derived_order_trace"
  | "notification_outbox"
  | "manual"
  | "future_event_store";

/**
 * Canonical string kinds for cross-surface stitching.
 * Prefer dotted namespaces; only emit kinds the UI or ingest layer understands.
 */
export const OperationalEventKind = {
  ORDER_CREATED: "order.created",
  PAYMENT_FINANCE_VERIFIED: "payment.finance_verified",
  PAYMENT_ADVANCE_STATE: "payment.advance_state",
  DISPATCH_VISIBILITY: "dispatch.visibility",
  STORE_REQUISITION_PENDING: "store.requisition_pending",
  PRODUCTION_JOBS_OPEN: "production.jobs_open",
  PACKING_PROGRESS: "dispatch.packing_progress",
  ORDER_LIFECYCLE_HINT: "order.lifecycle_hint",
} as const;

export type OperationalEventKindValue = (typeof OperationalEventKind)[keyof typeof OperationalEventKind];

export interface OperationalEventRecord {
  /** Deterministic id for dedupe within a merged feed */
  id: string;
  /** Canonical kind string; prefer `OperationalEventKind` constants when emitting */
  kind: string;
  category: OperationalEventCategory;
  severity: OperationalEventSeverity;
  title: string;
  detail?: string;
  /** ISO 8601 from an authoritative column only; otherwise null */
  occurredAt: string | null;
  /** Stable ordering when occurredAt is null or ties */
  sortKey: number;
  actor: OperationalEventActor;
  entities: OperationalEntityRef[];
  source: OperationalEventSource;
}
