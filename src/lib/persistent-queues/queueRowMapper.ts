import type { WorkQueueId } from "@/lib/work-queues/queueTypes";
import type { EntityPriorityBand } from "@/lib/entity-graph/entityPriority";
import type { PersistentQueueState } from "./persistentQueueTypes";

export type QueueItemRow = {
  id: string;
  queue_type: string;
  entity_type: string;
  entity_id: string;
  order_id: string | null;
  customer_id: string | null;
  title: string;
  summary: string | null;
  priority: string;
  state: string;
  owner_department: string | null;
  assigned_to: string | null;
  escalation_level: string;
  blocker_code: string | null;
  blocker_summary: string | null;
  sla_due_at: string | null;
  source: string;
  version: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  cancelled_at: string | null;
};

export interface MappedQueueItem {
  id: string;
  queueType: WorkQueueId;
  entityType: string;
  entityId: string;
  orderId: string | null;
  customerId: string | null;
  title: string;
  summary: string | null;
  priority: string;
  state: PersistentQueueState;
  ownerDepartment: string | null;
  assignedTo: string | null;
  escalationLevel: string;
  blockerCode: string | null;
  blockerSummary: string | null;
  slaDueAt: string | null;
  source: string;
  version: number;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
}

const QUEUE_DEPARTMENT: Partial<Record<WorkQueueId, string>> = {
  finance_review_queue: "finance",
  production_queue: "production",
  assembly_queue: "assembly",
  dispatch_queue: "dispatch",
  retail_followup_queue: "retail",
  reservation_verification_queue: "store",
  governance_review_queue: "governance",
  inventory_verification_queue: "inventory",
  scan_exception_queue: "dispatch",
  customer_support_queue: "support",
};

export function priorityBandToDbPriority(band: EntityPriorityBand): string {
  const map: Record<EntityPriorityBand, string> = {
    routine: "normal",
    elevated: "normal",
    urgent: "urgent",
    critical: "urgent",
  };
  return map[band] ?? "normal";
}

export function defaultOwnerDepartment(queueType: WorkQueueId): string | null {
  return QUEUE_DEPARTMENT[queueType] ?? null;
}

export function mapQueueRow(row: QueueItemRow): MappedQueueItem {
  return {
    id: row.id,
    queueType: row.queue_type as WorkQueueId,
    entityType: row.entity_type,
    entityId: row.entity_id,
    orderId: row.order_id,
    customerId: row.customer_id,
    title: row.title,
    summary: row.summary,
    priority: row.priority,
    state: row.state as PersistentQueueState,
    ownerDepartment: row.owner_department,
    assignedTo: row.assigned_to,
    escalationLevel: row.escalation_level,
    blockerCode: row.blocker_code,
    blockerSummary: row.blocker_summary,
    slaDueAt: row.sla_due_at,
    source: row.source,
    version: row.version,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
    cancelledAt: row.cancelled_at,
  };
}
