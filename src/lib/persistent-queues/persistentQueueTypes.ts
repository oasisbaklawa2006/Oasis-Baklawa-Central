import type { WorkQueueId } from "@/lib/work-queues/queueTypes";
import type { OperationalOwnerRole } from "@/lib/entity-graph/entityOwnership";
import type { EntityRef } from "@/lib/entity-graph/entityTypes";
import type { EntityPriorityBand } from "@/lib/entity-graph/entityPriority";
import type { OperationalSeverity, EscalationTier } from "@/lib/entity-graph/entityEscalation";

/** Durable queue item lifecycle — authority-gated transitions only. */
export const PERSISTENT_QUEUE_STATES = [
  "pending",
  "acknowledged",
  "assigned",
  "in_progress",
  "blocked",
  "escalated",
  "completed",
  "failed",
  "cancelled",
] as const;

export type PersistentQueueState = (typeof PERSISTENT_QUEUE_STATES)[number];

export type QueueFreshnessStatus = "fresh" | "stale" | "breached" | "unknown";

export interface PersistentQueueItemId {
  readonly value: string;
}

export interface PersistentQueueItemRecord {
  id: PersistentQueueItemId;
  queueId: WorkQueueId;
  entityRefs: EntityRef[];
  state: PersistentQueueState;
  priorityBand: EntityPriorityBand;
  priorityScore: number;
  ownerUserId: string | null;
  ownerRole: OperationalOwnerRole;
  acknowledgedAt: string | null;
  assignedAt: string | null;
  escalationTier: EscalationTier | null;
  escalatedAt: string | null;
  blockedReasonCode: string | null;
  customerImpact: boolean;
  operationalSeverity: OperationalSeverity;
  slaDueAt: string | null;
  freshnessStatus: QueueFreshnessStatus;
  title: string;
  summary: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
  createdByUserId: string;
  lastActorUserId: string;
}

export interface QueueAssignmentRecord {
  id: string;
  queueItemId: PersistentQueueItemId;
  fromUserId: string | null;
  toUserId: string;
  toRole: OperationalOwnerRole;
  reason: string | null;
  transferredAt: string;
  actorUserId: string;
}

export interface QueueEscalationRecord {
  queueItemId: PersistentQueueItemId;
  tier: EscalationTier;
  severity: OperationalSeverity;
  reason: string;
  escalatedAt: string;
  actorUserId: string;
}

export interface QueueFailureRecord {
  queueItemId: PersistentQueueItemId;
  code: string;
  message: string;
  retryable: boolean;
  failedAt: string;
  actorUserId: string;
}
