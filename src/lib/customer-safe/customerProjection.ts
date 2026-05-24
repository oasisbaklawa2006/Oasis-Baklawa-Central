import type { EntityGraphProjection } from "@/lib/entity-graph/entityProjection";
import type { CustomerSafeStatus, CustomerSafeStatusCode } from "./customerSafeStatus";
import { CUSTOMER_SAFE_STATUS_CATALOG, isSuppressedInternalLabel } from "./customerSafeStatus";
import { projectCustomerSafeTimeline } from "./customerSafeTimeline";
import type { RawTimelineEventInput } from "@/lib/operational-timeline/timelineEntityProjection";

export interface CustomerSafeOrderProjection {
  orderId: string;
  displayLabel: string;
  statuses: CustomerSafeStatus[];
  timeline: ReturnType<typeof projectCustomerSafeTimeline>;
  /** True when internal graph had suppressed events. */
  hadSuppressedEvents: boolean;
}

export interface CustomerProjectionInput {
  orderId: string;
  displayLabel: string;
  activeStatus: CustomerSafeStatusCode;
  completedStatuses?: CustomerSafeStatusCode[];
  timelineEvents?: RawTimelineEventInput[];
  internalGraph?: EntityGraphProjection;
}

export function projectCustomerSafeOrder(input: CustomerProjectionInput): CustomerSafeOrderProjection {
  const completed = new Set(input.completedStatuses ?? []);
  const statuses = CUSTOMER_SAFE_STATUS_CATALOG.map((s) => ({
    ...s,
    active: s.code === input.activeStatus,
    completed: completed.has(s.code) || s.code === input.activeStatus,
  }));

  const rawEvents = input.timelineEvents ?? [];
  const hadSuppressed = rawEvents.some(
    (e) =>
      e.visibilityClass === "governance_internal" ||
      e.visibilityClass === "escalation_internal" ||
      isSuppressedInternalLabel(e.title),
  );

  if (input.internalGraph) {
    for (const node of input.internalGraph.nodes) {
      if (node.metadata && isSuppressedInternalLabel(JSON.stringify(node.metadata))) {
        void node;
      }
    }
  }

  return {
    orderId: input.orderId,
    displayLabel: input.displayLabel,
    statuses,
    timeline: projectCustomerSafeTimeline(rawEvents),
    hadSuppressedEvents: hadSuppressed,
  };
}
