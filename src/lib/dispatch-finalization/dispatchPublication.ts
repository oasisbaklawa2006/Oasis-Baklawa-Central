import type { RawTimelineEventInput } from "@/lib/operational-timeline/timelineEntityProjection";
import { filterCustomerSafeTimelineInputs, projectCustomerSafeTimeline } from "@/lib/customer-safe/customerSafeTimeline";
import { isSuppressedInternalLabel } from "@/lib/customer-safe/customerSafeStatus";

const CUSTOMER_SAFE_DISPATCH_KINDS = new Set([
  "dispatch_finalized",
  "dispatch_transport_handoff_finalized",
  "dispatch_customer_release_published",
]);

export function isCustomerSafeDispatchEventKind(kind: string): boolean {
  return CUSTOMER_SAFE_DISPATCH_KINDS.has(kind);
}

export function buildCustomerPublicationTimelineInputs(
  orderId: string,
  occurredAt: string,
  transporterLabel?: string,
): RawTimelineEventInput[] {
  const detail = transporterLabel ? `Carrier: ${transporterLabel}` : undefined;
  return [
    {
      id: `cust-disp-${orderId}`,
      at: occurredAt,
      title: "Dispatched",
      summary: detail,
      visibilityClass: "public_curated",
      severity: "low",
      entityRefs: [{ type: "order", id: orderId }],
    },
    {
      id: `cust-transit-${orderId}`,
      at: occurredAt,
      title: "In transit",
      summary: detail,
      visibilityClass: "public_curated",
      severity: "low",
      entityRefs: [{ type: "order", id: orderId }],
    },
  ];
}

export function projectCustomerPublicationPreview(
  orderId: string,
  occurredAt: string,
  transporterLabel?: string,
) {
  const inputs = buildCustomerPublicationTimelineInputs(orderId, occurredAt, transporterLabel);
  const safe = filterCustomerSafeTimelineInputs(inputs);
  return projectCustomerSafeTimeline(safe);
}

/** Suppress internal finalization events from customer-facing feeds. */
export function suppressInternalFinalizationFromCustomer(eventTitle: string, eventKind: string): boolean {
  if (!isCustomerSafeDispatchEventKind(eventKind)) return true;
  if (isSuppressedInternalLabel(eventTitle)) return true;
  const lower = eventTitle.toLowerCase();
  return (
    lower.includes("reversal") ||
    lower.includes("override") ||
    lower.includes("finance") ||
    lower.includes("gate issue") ||
    lower.includes("stock consumption") ||
    lower.includes("hold")
  );
}
