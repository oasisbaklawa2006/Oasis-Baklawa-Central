import type { EntityRef } from "@/lib/entity-graph/entityTypes";
import type { OperationalOwnerRole } from "@/lib/entity-graph/entityOwnership";
import type { OperationalSeverity, EscalationTier } from "@/lib/entity-graph/entityEscalation";
import type { EntityPriorityBand } from "@/lib/entity-graph/entityPriority";
import type { EntityReadinessProjection } from "@/lib/entity-graph/entityReadiness";

export const WORK_QUEUE_IDS = [
  "finance_review_queue",
  "production_queue",
  "assembly_queue",
  "dispatch_queue",
  "retail_followup_queue",
  "reservation_verification_queue",
  "governance_review_queue",
  "inventory_verification_queue",
  "scan_exception_queue",
  "customer_support_queue",
] as const;

export type WorkQueueId = (typeof WORK_QUEUE_IDS)[number];

export interface QueueBlocker {
  code: string;
  label: string;
  isRoot?: boolean;
}

export type DependencyState = "satisfied" | "waiting" | "blocked";

export interface QueueItemDependencyState {
  state: DependencyState;
  waitingOn?: string;
  downstreamImpact?: string;
}

export interface WorkQueueItem {
  id: string;
  queueId: WorkQueueId;
  entityRefs: EntityRef[];
  priority: EntityPriorityBand;
  priorityScore: number;
  readiness: EntityReadinessProjection;
  blockers: QueueBlocker[];
  ownerRole: OperationalOwnerRole;
  escalationTier: EscalationTier;
  escalationSeverity: OperationalSeverity;
  dependency: QueueItemDependencyState;
  customerImpact: boolean;
  /** Hours since item entered queue projection (from input, not invented). */
  agingHours?: number;
  operationalSeverity: OperationalSeverity;
  title: string;
  summary?: string;
}

export interface WorkQueueSnapshot {
  queueId: WorkQueueId;
  label: string;
  items: WorkQueueItem[];
  /** null = feed not connected; never coerce to 0. */
  pressureCount: number | null;
  generatedAt: string;
}

export const WORK_QUEUE_LABELS: Record<WorkQueueId, string> = {
  finance_review_queue: "Finance review",
  production_queue: "Production",
  assembly_queue: "Assembly",
  dispatch_queue: "Dispatch",
  retail_followup_queue: "Retail follow-up",
  reservation_verification_queue: "Reservation verification",
  governance_review_queue: "Governance review",
  inventory_verification_queue: "Inventory verification",
  scan_exception_queue: "Scan exceptions",
  customer_support_queue: "Customer support",
};
