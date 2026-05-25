import type { OperationalStoreEventRecord } from "@/lib/operational-events/operationalEventTypes";
import type {
  CustomerTimelineMappingExplanation,
  CustomerTimelineProjectionResult,
  CustomerTimelineStatusCode,
} from "./customerTimelineTypes";
import { deriveComplaintState } from "./customerTimelineComplaintProjection";
import { mapOperationalEventToCustomerStatus } from "./customerTimelineEventMapper";
import {
  buildStepCatalog,
  CUSTOMER_JOURNEY_ORDER,
  CUSTOMER_STATUS_PUBLIC_LABELS,
  maxStatus,
  statusIndex,
} from "./customerTimelineStatus";
import { computeSupportWindowEndsAt, isSupportWindowActive } from "./customerTimelineSupportWindow";
import { curatedSafeDetail } from "./customerTimelineSuppression";

export interface ProjectCustomerTimelineInput {
  orderId: string;
  events: OperationalStoreEventRecord[];
  nowIso?: string;
  /** Optional baseline from order row — never exposes raw status string to customer. */
  baselineStatus?: CustomerTimelineStatusCode;
}

export function projectCustomerTimelineFromEvents(
  input: ProjectCustomerTimelineInput,
): CustomerTimelineProjectionResult {
  const nowIso = input.nowIso ?? new Date().toISOString();
  let current: CustomerTimelineStatusCode = input.baselineStatus ?? "order_placed";
  let lastPublicUpdateAt: string | null = null;
  let safeDetail: string | null = null;
  let deliveredAt: string | null = null;
  let suppressedEventCount = 0;
  const mappingExplanations: CustomerTimelineMappingExplanation[] = [];

  const sorted = [...input.events].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  for (const ev of sorted) {
    const mapped = mapOperationalEventToCustomerStatus(ev);
    mappingExplanations.push({
      eventType: ev.eventType,
      mappedTo: mapped.status,
      reason: mapped.reason,
      suppressed: mapped.suppressed,
    });
    if (mapped.suppressed) {
      suppressedEventCount += 1;
      continue;
    }
    if (mapped.status) {
      current = maxStatus(current, mapped.status);
      lastPublicUpdateAt = ev.createdAt;
      safeDetail = mapped.safeDetail ? curatedSafeDetail(mapped.safeDetail) : safeDetail;
      if (mapped.status === "delivered") deliveredAt = ev.createdAt;
    }
  }

  const complaintState = deriveComplaintState(input.events);
  if (complaintState === "under_review") current = "complaint_under_review";
  if (complaintState === "resolved") current = "resolved";

  if (current === "delivered" || statusIndex(current) >= statusIndex("delivered")) {
    if (isSupportWindowActive(deliveredAt ?? lastPublicUpdateAt, nowIso)) {
      current = maxStatus(current, "support_window_active");
    }
  }

  const steps = buildStepCatalog(
    complaintState === "under_review"
      ? "complaint_under_review"
      : complaintState === "resolved"
        ? "resolved"
        : current,
  );

  const journeySteps = steps.filter((s) => CUSTOMER_JOURNEY_ORDER.includes(s.code as CustomerTimelineStatusCode));
  const completedCount = journeySteps.filter((s) => s.completed).length;
  const progressPercent =
    journeySteps.length === 0 ? 0 : Math.round((completedCount / journeySteps.length) * 100);

  const activeIdx = statusIndex(current);
  const nextCode = CUSTOMER_JOURNEY_ORDER[activeIdx + 1];
  const estimatedNextStepLabel = nextCode ? CUSTOMER_STATUS_PUBLIC_LABELS[nextCode] : null;

  return {
    orderId: input.orderId,
    currentStatus: current,
    steps,
    progressPercent,
    lastPublicUpdateAt,
    estimatedNextStepLabel,
    safeDetail,
    supportWindowEndsAt: computeSupportWindowEndsAt(deliveredAt),
    complaintState,
    suppressedEventCount,
    mappingExplanations,
    derivedFromEventCount: sorted.length,
  };
}
