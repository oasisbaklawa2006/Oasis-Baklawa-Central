import { requireExecutionAuthority } from "@/lib/execution-authority/executionAuthorityGuard";
import type { ExecutionAuthorityContext } from "@/lib/execution-authority/executionAuthorityTypes";
import type { OperationalEventRepository } from "@/lib/operational-events/operationalEventRepository";
import type { OperationalStoreEventType } from "@/lib/operational-events/operationalEventTypes";
import type { WorkQueueId } from "@/lib/work-queues/queueTypes";
import type { EntityPriorityBand } from "@/lib/entity-graph/entityPriority";
import {
  applyQueueLifecycleTransition,
  type QueueLifecycleAction,
  type QueueTransitionError,
  type QueueTransitionResult,
} from "./queueLifecycle";
import {
  authorityActionForLifecycle,
  lifecycleActionToEventType,
  terminalTimestampsForState,
} from "./queueEventBridge";
import {
  defaultOwnerDepartment,
  mapQueueRow,
  priorityBandToDbPriority,
  type MappedQueueItem,
  type QueueItemRow,
} from "./queueRowMapper";
import type { PersistentQueueState } from "./persistentQueueTypes";

export interface QueueWriteCorrelation {
  correlationId: string;
  actorUserId: string;
  actorRole: string;
  actorDepartment?: string | null;
  idempotencyKey?: string | null;
  occurredAt?: string;
}

export interface CreatePersistentQueueItemInput {
  queueType: WorkQueueId;
  entityType: string;
  entityId: string;
  orderId?: string | null;
  customerId?: string | null;
  title: string;
  summary?: string | null;
  priorityBand: EntityPriorityBand;
  slaDueAt?: string | null;
  source?: string;
}

export interface AssignPersistentQueueInput {
  queueItemId: string;
  expectedVersion: number;
  toUserId: string | null;
  toDepartment?: string | null;
  reason?: string | null;
}

export interface TransitionPersistentQueueInput {
  queueItemId: string;
  expectedVersion: number;
  action: QueueLifecycleAction;
  reasonCode?: string | null;
  reasonText?: string | null;
  blockerCode?: string | null;
  blockerSummary?: string | null;
}

export interface QueueWriteResult {
  item: MappedQueueItem;
  eventId: string;
}

export interface QueueStoreAdapter {
  getRow(id: string): Promise<QueueItemRow | null>;
  insertRow(row: Partial<QueueItemRow> & Pick<QueueItemRow, "queue_type" | "entity_type" | "entity_id" | "title">): Promise<QueueItemRow>;
  updateRow(
    id: string,
    expectedVersion: number,
    patch: Partial<QueueItemRow>,
  ): Promise<QueueItemRow>;
  insertAssignment(row: {
    queue_item_id: string;
    from_user_id: string | null;
    to_user_id: string | null;
    from_department: string | null;
    to_department: string | null;
    reason: string | null;
    assigned_by: string | null;
  }): Promise<{ id: string }>;
}

function assertTransition(result: QueueTransitionResult | QueueTransitionError): QueueTransitionResult {
  if (!result.ok) {
    throw new Error((result as QueueTransitionError).message);
  }
  return result;
}

function requireTransitionReason(reason: string, action: string): void {
  if (!reason?.trim()) {
    throw new Error(`${action} requires a non-empty reason`);
  }
}

function authorityCtx(
  correlation: QueueWriteCorrelation,
  queueType?: WorkQueueId,
): ExecutionAuthorityContext {
  return {
    actorUserId: correlation.actorUserId,
    actorRole: correlation.actorRole,
    actorDepartment: correlation.actorDepartment,
    queueType,
    idempotencyKey: correlation.idempotencyKey,
  };
}

async function appendQueueEvent(
  events: OperationalEventRepository,
  correlation: QueueWriteCorrelation,
  eventType: OperationalStoreEventType,
  item: MappedQueueItem,
  title: string,
  extra?: {
    reasonCode?: string | null;
    reasonText?: string | null;
    message?: string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<string> {
  const ev = await events.appendEvent({
    eventType,
    entityType: item.entityType,
    entityId: item.entityId,
    orderId: item.orderId,
    customerId: item.customerId,
    queueItemId: item.id,
    actorId: correlation.actorUserId,
    actorRole: correlation.actorRole,
    actorDepartment: correlation.actorDepartment,
    title,
    message: extra?.message ?? item.summary,
    reasonCode: extra?.reasonCode ?? null,
    reasonText: extra?.reasonText ?? null,
    metadata: extra?.metadata ?? { queueType: item.queueType, state: item.state },
    correlationId: correlation.correlationId,
    idempotencyKey: correlation.idempotencyKey ?? null,
  });
  return ev.id;
}

export function createPersistentQueueRepository(
  store: QueueStoreAdapter,
  events: OperationalEventRepository,
) {
  return {
    async createQueueItem(
      input: CreatePersistentQueueItemInput,
      correlation: QueueWriteCorrelation,
    ): Promise<QueueWriteResult> {
      requireExecutionAuthority("queue:create", authorityCtx(correlation, input.queueType));
      const idemKey = correlation.idempotencyKey;
      if (idemKey) {
        const existing = await events.findByIdempotencyKey(idemKey);
        if (existing?.queueItemId) {
          const row = await store.getRow(existing.queueItemId);
          if (row) {
            return { item: mapQueueRow(row), eventId: existing.id };
          }
        }
      }
      const now = correlation.occurredAt ?? new Date().toISOString();
      const row = await store.insertRow({
        queue_type: input.queueType,
        entity_type: input.entityType,
        entity_id: input.entityId,
        order_id: input.orderId ?? null,
        customer_id: input.customerId ?? null,
        title: input.title,
        summary: input.summary ?? null,
        priority: priorityBandToDbPriority(input.priorityBand),
        state: "pending",
        owner_department: defaultOwnerDepartment(input.queueType),
        assigned_to: null,
        escalation_level: "none",
        blocker_code: null,
        blocker_summary: null,
        sla_due_at: input.slaDueAt ?? null,
        source: input.source ?? "execution_os",
        version: 1,
        created_by: correlation.actorUserId,
        updated_by: correlation.actorUserId,
        created_at: now,
        updated_at: now,
        completed_at: null,
        cancelled_at: null,
      });
      const item = mapQueueRow(row);
      const eventId = await appendQueueEvent(events, correlation, "queue_created", item, `Queue item created: ${item.title}`);
      return { item, eventId };
    },

    async assignQueueItem(
      input: AssignPersistentQueueInput,
      correlation: QueueWriteCorrelation,
    ): Promise<QueueWriteResult> {
      const row = await store.getRow(input.queueItemId);
      if (!row) throw new Error("Queue item not found");
      const item = mapQueueRow(row);
      requireExecutionAuthority("queue:assign", authorityCtx(correlation, item.queueType));
      const transition = assertTransition(
        applyQueueLifecycleTransition({ from: item.state, action: "assign" }),
      );
      const now = correlation.occurredAt ?? new Date().toISOString();
      await store.insertAssignment({
        queue_item_id: item.id,
        from_user_id: item.assignedTo,
        to_user_id: input.toUserId,
        from_department: item.ownerDepartment,
        to_department: input.toDepartment ?? item.ownerDepartment,
        reason: input.reason ?? null,
        assigned_by: correlation.actorUserId,
      });
      const updated = await store.updateRow(item.id, input.expectedVersion, {
        state: transition.to,
        assigned_to: input.toUserId,
        owner_department: input.toDepartment ?? item.ownerDepartment,
        updated_by: correlation.actorUserId,
        updated_at: now,
        version: item.version + 1,
      });
      const mapped = mapQueueRow(updated);
      const eventId = await appendQueueEvent(
        events,
        { ...correlation, idempotencyKey: correlation.idempotencyKey ?? `assign:${item.id}:${input.expectedVersion}` },
        "queue_assigned",
        mapped,
        `Queue assigned`,
        { reasonText: input.reason ?? null },
      );
      return { item: mapped, eventId };
    },

    async transitionQueueItem(
      input: TransitionPersistentQueueInput,
      correlation: QueueWriteCorrelation,
    ): Promise<QueueWriteResult> {
      const row = await store.getRow(input.queueItemId);
      if (!row) throw new Error("Queue item not found");
      const item = mapQueueRow(row);
      const authAction = authorityActionForLifecycle(input.action);
      requireExecutionAuthority(authAction, authorityCtx(correlation, item.queueType));
      const transition = assertTransition(
        applyQueueLifecycleTransition({ from: item.state, action: input.action }),
      );
      const now = correlation.occurredAt ?? new Date().toISOString();
      const terminals = terminalTimestampsForState(transition.to, now);
      const eventType = lifecycleActionToEventType(input.action);
      const patch: Partial<QueueItemRow> = {
        state: transition.to,
        updated_by: correlation.actorUserId,
        updated_at: now,
        version: item.version + 1,
        completed_at: terminals.completedAt,
        cancelled_at: terminals.cancelledAt,
      };
      if (input.blockerCode) patch.blocker_code = input.blockerCode;
      if (input.blockerSummary) patch.blocker_summary = input.blockerSummary;
      if (input.action === "escalate") patch.escalation_level = "tier1";
      if (input.action === "de_escalate") patch.escalation_level = "none";
      const updated = await store.updateRow(item.id, input.expectedVersion, patch);
      const mapped = mapQueueRow(updated);
      const eventId = await appendQueueEvent(events, correlation, eventType, mapped, `Queue ${input.action}`, {
        reasonCode: input.reasonCode ?? null,
        reasonText: input.reasonText ?? null,
      });
      return { item: mapped, eventId };
    },

    async escalateQueueItem(
      queueItemId: string,
      expectedVersion: number,
      reason: string,
      correlation: QueueWriteCorrelation,
    ): Promise<QueueWriteResult> {
      return this.transitionQueueItem(
        {
          queueItemId,
          expectedVersion,
          action: "escalate",
          reasonText: reason,
        },
        correlation,
      );
    },

    async failQueueItem(
      queueItemId: string,
      expectedVersion: number,
      reason: string,
      correlation: QueueWriteCorrelation,
    ): Promise<QueueWriteResult> {
      requireTransitionReason(reason, "queue:fail");
      return this.transitionQueueItem(
        {
          queueItemId,
          expectedVersion,
          action: "fail",
          reasonText: reason,
          reasonCode: "queue_failed",
        },
        correlation,
      );
    },

    async cancelQueueItem(
      queueItemId: string,
      expectedVersion: number,
      reason: string,
      correlation: QueueWriteCorrelation,
    ): Promise<QueueWriteResult> {
      requireTransitionReason(reason, "queue:cancel");
      return this.transitionQueueItem(
        {
          queueItemId,
          expectedVersion,
          action: "cancel",
          reasonText: reason,
          reasonCode: "queue_cancelled",
        },
        correlation,
      );
    },

    async addOperationalNote(
      queueItemId: string,
      note: string,
      correlation: QueueWriteCorrelation,
      extraMetadata?: Record<string, unknown>,
    ): Promise<{ eventId: string }> {
      const row = await store.getRow(queueItemId);
      if (!row) throw new Error("Queue item not found");
      const item = mapQueueRow(row);
      requireExecutionAuthority("queue:note", authorityCtx(correlation, item.queueType));
      const eventId = await appendQueueEvent(events, correlation, "operational_note_added", item, "Operational note", {
        message: note,
        metadata: { note, ...extraMetadata },
      });
      return { eventId };
    },
  };
}

export type PersistentQueueWriteService = ReturnType<typeof createPersistentQueueRepository>;
