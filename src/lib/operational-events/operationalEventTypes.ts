/** Authoritative append-only operational event store (Phase 3D). */

export const OPERATIONAL_STORE_EVENT_TYPES = [
  "queue_created",
  "queue_acknowledged",
  "queue_assigned",
  "queue_started",
  "queue_blocked",
  "queue_escalated",
  "queue_completed",
  "queue_failed",
  "queue_cancelled",
  "operational_note_added",
] as const;

export type OperationalStoreEventType = (typeof OPERATIONAL_STORE_EVENT_TYPES)[number];

export type OperationalEventVisibility = "internal" | "public_candidate" | "staff_only";

export type OperationalStoreEventSeverity = "info" | "warning" | "urgent" | "critical";

export interface OperationalStoreEventRecord {
  id: string;
  eventType: OperationalStoreEventType;
  entityType: string;
  entityId: string;
  orderId: string | null;
  customerId: string | null;
  queueItemId: string | null;
  actorId: string | null;
  actorRole: string | null;
  actorDepartment: string | null;
  visibility: OperationalEventVisibility;
  severity: OperationalStoreEventSeverity;
  title: string;
  message: string | null;
  reasonCode: string | null;
  reasonText: string | null;
  metadata: Record<string, unknown>;
  correlationId: string;
  idempotencyKey: string | null;
  createdAt: string;
}

export interface AppendOperationalEventInput {
  eventType: OperationalStoreEventType;
  entityType: string;
  entityId: string;
  orderId?: string | null;
  customerId?: string | null;
  queueItemId?: string | null;
  actorId: string;
  actorRole: string;
  actorDepartment?: string | null;
  visibility?: OperationalEventVisibility;
  severity?: OperationalStoreEventSeverity;
  title: string;
  message?: string | null;
  reasonCode?: string | null;
  reasonText?: string | null;
  metadata?: Record<string, unknown>;
  correlationId: string;
  idempotencyKey?: string | null;
}
