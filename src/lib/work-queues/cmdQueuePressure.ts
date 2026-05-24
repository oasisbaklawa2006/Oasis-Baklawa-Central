import { financeBlocksProductionProjection } from "@/lib/dependency-graph/dependencyProjection";
import type { WorkQueueId } from "./queueTypes";
import { projectWorkQueues } from "./queueProjection";

export interface CmdQueuePressureInput {
  financeHoldCount: number;
  dispatchPanicCount: number;
  triageReviewCount: number;
  scanAnomalyCount: number | null;
  reservationRiskCount: number | null;
}

export interface CmdQueuePressureProjection {
  unifiedRootBlocker: string | null;
  unifiedBlockerContext: string | null;
  financeToDispatchRisk: boolean;
  customerRiskQueuePressure: number | null;
  reservationVerificationLoad: number | null;
  scanExceptionPressure: number | null;
  escalationHotspotQueue: WorkQueueId | null;
  /** Per-queue pressure — null when not connected. */
  queuePressureByQueue: Partial<Record<WorkQueueId, number | null>>;
}

/**
 * CMD queue pressure from explicit inputs only — never invents counts.
 */
export function projectCmdQueuePressure(input: CmdQueuePressureInput): CmdQueuePressureProjection {
  const dep = financeBlocksProductionProjection();
  const root = dep.resolution.rootBlocker;

  const itemsByQueue: Parameters<typeof projectWorkQueues>[0]["itemsByQueue"] = {};
  if (input.financeHoldCount > 0) {
    itemsByQueue.finance_review_queue = Array.from({ length: Math.min(input.financeHoldCount, 5) }, (_, i) => ({
      id: `finance-hold-${i}`,
      queueId: "finance_review_queue" as const,
      title: `Finance review item ${i + 1}`,
      entityId: `war-room-finance-${i}`,
      blockers: [{ code: "finance", label: "Finance verification pending", isRoot: true }],
      customerImpact: true,
      operationalSeverity: "high" as const,
      upstreamSatisfied: false,
      upstreamLabel: "finance",
      downstreamLabel: "production",
    }));
  }
  if (input.dispatchPanicCount > 0) {
    itemsByQueue.dispatch_queue = [
      {
        id: "dispatch-panic-0",
        queueId: "dispatch_queue",
        title: "Dispatch panic attention",
        entityId: "war-room-dispatch-panic",
        customerImpact: true,
        operationalSeverity: "critical",
      },
    ];
  }
  if (input.triageReviewCount > 0) {
    itemsByQueue.customer_support_queue = [
      {
        id: "triage-0",
        queueId: "customer_support_queue",
        title: "Manual verification / triage",
        entityId: "war-room-triage",
        customerImpact: true,
        operationalSeverity: "medium",
      },
    ];
  }

  const snapshots = projectWorkQueues({
    itemsByQueue,
    pressureByQueue: {
      finance_review_queue: input.financeHoldCount > 0 ? input.financeHoldCount : null,
      dispatch_queue: input.dispatchPanicCount > 0 ? input.dispatchPanicCount : null,
      customer_support_queue: input.triageReviewCount > 0 ? input.triageReviewCount : null,
      scan_exception_queue: input.scanAnomalyCount,
      reservation_verification_queue: input.reservationRiskCount,
      production_queue: null,
      assembly_queue: null,
      retail_followup_queue: null,
      governance_review_queue: input.financeHoldCount > 0 ? input.financeHoldCount : null,
      inventory_verification_queue: null,
    },
  });

  const pressureMap = Object.fromEntries(snapshots.map((s) => [s.queueId, s.pressureCount])) as Partial<
    Record<WorkQueueId, number | null>
  >;

  let escalationHotspotQueue: WorkQueueId | null = null;
  let maxPressure = 0;
  for (const s of snapshots) {
    if (s.pressureCount !== null && s.pressureCount > maxPressure) {
      maxPressure = s.pressureCount;
      escalationHotspotQueue = s.queueId;
    }
  }

  const customerRisk =
    input.financeHoldCount + input.dispatchPanicCount + input.triageReviewCount > 0
      ? input.financeHoldCount + input.dispatchPanicCount + input.triageReviewCount
      : null;

  return {
    unifiedRootBlocker: root?.label ?? null,
    unifiedBlockerContext: dep.resolution.escalationRecommendation,
    financeToDispatchRisk: dep.resolution.customerImpact && root?.lane === "finance",
    customerRiskQueuePressure: customerRisk,
    reservationVerificationLoad: input.reservationRiskCount,
    scanExceptionPressure: input.scanAnomalyCount,
    escalationHotspotQueue,
    queuePressureByQueue: pressureMap,
  };
}
