import type { OperationalStoreEventRecord } from "@/lib/operational-events/operationalEventTypes";
import type { CustomerTimelineStatusCode } from "./customerTimelineTypes";
import { isEventSuppressedForCustomer } from "./customerTimelineSuppression";

export interface EventMappingResult {
  status: CustomerTimelineStatusCode | null;
  safeDetail: string | null;
  reason: string;
  suppressed: boolean;
}

function queueTypeFromEvent(event: OperationalStoreEventRecord): string | null {
  const qt = event.metadata?.queueType;
  return typeof qt === "string" ? qt : null;
}

function stageFromQueueType(queueType: string | null): CustomerTimelineStatusCode | null {
  if (!queueType) return null;
  if (queueType.includes("production")) return "manufacturing";
  if (queueType.includes("assembly")) return "assembly";
  if (queueType.includes("dispatch") || queueType.includes("scan")) return "packing";
  if (queueType.includes("finance")) return "invoice_generated";
  if (queueType.includes("customer_support")) return "complaint_under_review";
  if (queueType.includes("retail") || queueType.includes("inventory")) return "packing";
  return null;
}

/** Approved mappings only — never pass raw title/message to customer output. */
export function mapOperationalEventToCustomerStatus(event: OperationalStoreEventRecord): EventMappingResult {
  if (isEventSuppressedForCustomer(event)) {
    return {
      status: null,
      safeDetail: null,
      reason: "Suppressed by customer timeline firewall",
      suppressed: true,
    };
  }

  const qt = queueTypeFromEvent(event);
  const safeMilestone = event.metadata?.customerMilestone;
  if (typeof safeMilestone === "string" && isApprovedMilestone(safeMilestone)) {
    return {
      status: safeMilestone as CustomerTimelineStatusCode,
      safeDetail: curatedDetailForStatus(safeMilestone as CustomerTimelineStatusCode),
      reason: "Explicit safe customerMilestone in metadata",
      suppressed: false,
    };
  }

  switch (event.eventType) {
    case "queue_created":
      return { status: null, safeDetail: null, reason: "queue_created is internal-only", suppressed: false };

    case "queue_acknowledged":
      return {
        status: "confirmed",
        safeDetail: "Your order has been confirmed.",
        reason: "queue_acknowledged → confirmed",
        suppressed: false,
      };

    case "queue_started": {
      const stage = stageFromQueueType(qt) ?? "manufacturing";
      return {
        status: stage,
        safeDetail: curatedDetailForStatus(stage),
        reason: `queue_started → ${stage} via queue_type`,
        suppressed: false,
      };
    }

    case "queue_completed": {
      const stage = stageFromQueueType(qt) ?? "packing";
      return {
        status: stage,
        safeDetail: curatedDetailForStatus(stage),
        reason: `queue_completed → ${stage} stage complete`,
        suppressed: false,
      };
    }

    case "queue_assigned":
      return { status: null, safeDetail: null, reason: "assignment is internal-only", suppressed: false };

    case "scan_verified":
      return {
        status: "packing",
        safeDetail: "Packing verification completed.",
        reason: "scan_verified → packing (not dispatch completion)",
        suppressed: false,
      };

    case "gate_scan_verified":
      return {
        status: "packing",
        safeDetail: "Dispatch preparation verification completed.",
        reason: "gate_scan_verified → packing prep only (not dispatched)",
        suppressed: false,
      };

    case "department_handoff_verified":
      return {
        status: stageFromQueueType(qt) ?? "assembly",
        safeDetail: "Production handoff completed.",
        reason: "department_handoff_verified → assembly/packing",
        suppressed: false,
      };

    default: {
      const type = event.eventType as string;
      if (type === "complaint_acknowledged" || type === "complaint_opened") {
        return {
          status: "complaint_under_review",
          safeDetail: "We are reviewing your concern.",
          reason: "complaint → under_review",
          suppressed: false,
        };
      }
      if (type === "complaint_resolved") {
        return {
          status: "resolved",
          safeDetail: "Your concern has been resolved.",
          reason: "complaint_resolved → resolved",
          suppressed: false,
        };
      }
      return {
        status: null,
        safeDetail: null,
        reason: `Unmapped event type: ${event.eventType}`,
        suppressed: false,
      };
    }
  }
}

function isApprovedMilestone(value: string): boolean {
  return [
    "order_placed",
    "confirmed",
    "manufacturing",
    "assembly",
    "packing",
    "invoice_generated",
    "dispatched",
    "in_transit",
    "delivered",
    "support_window_active",
    "complaint_under_review",
    "resolved",
  ].includes(value);
}

function curatedDetailForStatus(status: CustomerTimelineStatusCode): string {
  const map: Partial<Record<CustomerTimelineStatusCode, string>> = {
    confirmed: "Your order has been confirmed.",
    manufacturing: "Your order is being prepared.",
    assembly: "Assembly is in progress.",
    packing: "Your order is being packed.",
    invoice_generated: "Your invoice has been prepared.",
    dispatched: "Your order has been dispatched.",
    in_transit: "Your order is on the way.",
    delivered: "Delivery has been completed.",
    complaint_under_review: "We are reviewing your concern.",
    resolved: "Your concern has been resolved.",
  };
  return map[status] ?? "Your order is progressing.";
}
