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

  const snapshots = projectWorkQueues({
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
