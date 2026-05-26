import type { WorkQueueId } from "@/lib/work-queues/queueTypes";
import type { MappedQueueItem } from "@/lib/persistent-queues/queueRowMapper";
import type { QueueWriteCorrelation } from "@/lib/persistent-queues/persistentQueueRepository";

/** Caller identity for every operational execution action. */
export interface OperationalExecutionContext {
  correlationId: string;
  actorUserId: string;
  actorRole: string;
  actorDepartment?: string | null;
  idempotencyKey?: string | null;
  occurredAt?: string;
}

export interface QueueExecutionActionInput {
  queueItemId: string;
  expectedVersion: number;
}

export interface AssignQueueExecutionInput extends QueueExecutionActionInput {
  toUserId: string | null;
  toDepartment?: string | null;
  reason?: string | null;
}

export interface BlockQueueExecutionInput extends QueueExecutionActionInput {
  reason: string;
  blockerCode?: string | null;
  blockerSummary?: string | null;
}

export interface ReasonedQueueExecutionInput extends QueueExecutionActionInput {
  reason: string;
  reasonCode?: string | null;
}

export interface OperationalNoteInput {
  queueItemId: string;
  note: string;
}

export interface QueueExecutionActionResult {
  item: MappedQueueItem;
  eventId: string;
}

export interface OperationalNoteResult {
  eventId: string;
}

export interface ListOpenQueueItemsFilter {
  queueType?: WorkQueueId;
  limit?: number;
}

export function toQueueWriteCorrelation(
  ctx: OperationalExecutionContext,
  actionSuffix?: string,
): QueueWriteCorrelation {
  return {
    correlationId: ctx.correlationId,
    actorUserId: ctx.actorUserId,
    actorRole: ctx.actorRole,
    actorDepartment: ctx.actorDepartment,
    idempotencyKey:
      ctx.idempotencyKey ??
      (actionSuffix ? `${actionSuffix}:${ctx.correlationId}` : undefined),
    occurredAt: ctx.occurredAt,
  };
}
