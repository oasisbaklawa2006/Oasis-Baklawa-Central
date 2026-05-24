import { entityRef } from "@/lib/entity-graph/entityTypes";
import { deriveEntityPriority } from "@/lib/entity-graph/entityPriority";
import { ownershipForQueue } from "./queueOwnership";
import { computeQueueItemScore, sortQueueItems } from "./queuePriority";
import { projectQueueDependency } from "./queueDependency";
import { projectQueueEscalation } from "./queueEscalation";
import { queueReadinessFromBlockers } from "./queueReadiness";
import type { WorkQueueId, WorkQueueItem, WorkQueueSnapshot } from "./queueTypes";
import { WORK_QUEUE_IDS, WORK_QUEUE_LABELS } from "./queueTypes";

export interface QueueItemBuildInput {
  id: string;
  queueId: WorkQueueId;
  title: string;
  summary?: string;
  entityId: string;
  entityType?: Parameters<typeof entityRef>[0];
  blockers?: { code: string; label: string; isRoot?: boolean }[];
  customerImpact?: boolean;
  operationalSeverity?: WorkQueueItem["operationalSeverity"];
  agingHours?: number;
  upstreamSatisfied?: boolean;
  upstreamLabel?: string;
  downstreamLabel?: string;
}

export function buildQueueItem(input: QueueItemBuildInput): WorkQueueItem {
  const ownership = ownershipForQueue(input.queueId);
  const blockers = input.blockers ?? [];
  const readiness = queueReadinessFromBlockers(blockers);
  const priority = deriveEntityPriority({
    customerImpact: input.customerImpact,
    severity: input.operationalSeverity,
    agingHours: input.agingHours,
    financeBlocked: input.queueId === "finance_review_queue",
    dispatchPanic: input.queueId === "dispatch_queue" && input.operationalSeverity === "critical",
  });
  const escalation = projectQueueEscalation(input.queueId, input.entityId);
  const entityType = input.entityType ?? "order";
  return {
    id: input.id,
    queueId: input.queueId,
    entityRefs: [entityRef(entityType, input.entityId)],
    priority,
    priorityScore: computeQueueItemScore({
      priority,
      operationalSeverity: input.operationalSeverity ?? escalation.severity,
      customerImpact: !!input.customerImpact,
      agingHours: input.agingHours,
      blockerCount: blockers.length,
    }),
    readiness,
    blockers,
    ownerRole: ownership?.ownerRole ?? "unassigned",
    escalationTier: escalation.tier,
    escalationSeverity: escalation.severity,
    dependency: projectQueueDependency({
      upstreamLabel: input.upstreamLabel ?? "upstream",
      upstreamSatisfied: input.upstreamSatisfied ?? true,
      downstreamLabel: input.downstreamLabel ?? input.title,
    }),
    customerImpact: !!input.customerImpact,
    agingHours: input.agingHours,
    operationalSeverity: input.operationalSeverity ?? escalation.severity,
    title: input.title,
    summary: input.summary,
  };
}

export interface WorkQueueProjectionInput {
  /** Items supplied by caller — never invented. */
  itemsByQueue?: Partial<Record<WorkQueueId, QueueItemBuildInput[]>>;
  /** Per-queue pressure from feeds; null when not connected. */
  pressureByQueue?: Partial<Record<WorkQueueId, number | null>>;
}

export function projectWorkQueues(input: WorkQueueProjectionInput = {}): WorkQueueSnapshot[] {
  const now = new Date().toISOString();
  return WORK_QUEUE_IDS.map((queueId) => {
    const rawItems = input.itemsByQueue?.[queueId] ?? [];
    const items = sortQueueItems(rawItems.map(buildQueueItem));
    const pressure = input.pressureByQueue?.[queueId] ?? (items.length > 0 ? items.length : null);
    return {
      queueId,
      label: WORK_QUEUE_LABELS[queueId],
      items,
      pressureCount: pressure,
      generatedAt: now,
    };
  });
}

/** Empty projection — all queues show not-connected pressure unless caller supplies items. */
export function emptyWorkQueueProjection(): WorkQueueSnapshot[] {
  return projectWorkQueues({
    pressureByQueue: Object.fromEntries(WORK_QUEUE_IDS.map((id) => [id, null])) as Partial<
      Record<WorkQueueId, number | null>
    >,
  });
}
