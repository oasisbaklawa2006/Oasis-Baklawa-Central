import type {
  PersistentQueueItemRecord,
  PersistentQueueItemId,
  QueueAssignmentRecord,
  QueueEscalationRecord,
  QueueFailureRecord,
  PersistentQueueState,
} from "./persistentQueueTypes";
import type { WorkQueueId } from "@/lib/work-queues/queueTypes";
import type { QueueLifecycleAction } from "./queueLifecycle";

/** Correlates queue writes with operational events (Phase 3D). */
export interface ExecutionCorrelation {
  correlationId: string;
  actorUserId: string;
  actorRole: string;
  occurredAt: string;
}

export interface CreateQueueItemInput {
  queueId: WorkQueueId;
  entityRefs: PersistentQueueItemRecord["entityRefs"];
  title: string;
  summary?: string;
  priorityBand: PersistentQueueItemRecord["priorityBand"];
  priorityScore: number;
  ownerRole: PersistentQueueItemRecord["ownerRole"];
  customerImpact: boolean;
  operationalSeverity: PersistentQueueItemRecord["operationalSeverity"];
  slaDueAt?: string | null;
}

export interface QueueTransitionCommand {
  itemId: PersistentQueueItemId;
  expectedVersion: number;
  action: QueueLifecycleAction;
  correlation: ExecutionCorrelation;
  payload?: Record<string, unknown>;
}

export interface AssignQueueItemCommand {
  itemId: PersistentQueueItemId;
  expectedVersion: number;
  toUserId: string;
  toRole: PersistentQueueItemRecord["ownerRole"];
  reason?: string;
  correlation: ExecutionCorrelation;
}

/**
 * Persistence boundary — implement in Supabase repository PR #106.
 * All mutations must emit operational events (separate store); no silent updates.
 */
export interface PersistentQueueReadRepository {
  getById(id: PersistentQueueItemId): Promise<PersistentQueueItemRecord | null>;
  listByQueue(
    queueId: WorkQueueId,
    states?: PersistentQueueState[],
  ): Promise<PersistentQueueItemRecord[]>;
  listByEntity(entityType: string, entityId: string): Promise<PersistentQueueItemRecord[]>;
  listAssignmentHistory(itemId: PersistentQueueItemId): Promise<QueueAssignmentRecord[]>;
}

export interface PersistentQueueWriteRepository {
  createItem(input: CreateQueueItemInput, correlation: ExecutionCorrelation): Promise<PersistentQueueItemRecord>;
  transition(cmd: QueueTransitionCommand): Promise<PersistentQueueItemRecord>;
  assign(cmd: AssignQueueItemCommand): Promise<{ item: PersistentQueueItemRecord; assignment: QueueAssignmentRecord }>;
  recordEscalation(record: QueueEscalationRecord, correlation: ExecutionCorrelation): Promise<void>;
  recordFailure(record: QueueFailureRecord, correlation: ExecutionCorrelation): Promise<void>;
}

export type PersistentQueueRepository = PersistentQueueReadRepository & PersistentQueueWriteRepository;
