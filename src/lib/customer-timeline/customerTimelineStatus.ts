import type { CustomerTimelineStatusCode, CustomerTimelineStepProjection } from "./customerTimelineTypes";

export const CUSTOMER_STATUS_PUBLIC_LABELS: Record<CustomerTimelineStatusCode, string> = {
  order_placed: "Order Placed",
  confirmed: "Confirmed",
  manufacturing: "Manufacturing",
  assembly: "Assembly",
  packing: "Packing",
  invoice_generated: "Invoice Generated",
  dispatched: "Dispatched",
  in_transit: "In Transit",
  delivered: "Delivered",
  support_window_active: "Support Window Active",
  complaint_under_review: "Complaint Under Review",
  resolved: "Resolved",
};

export const CUSTOMER_STATUS_DESCRIPTIONS: Record<CustomerTimelineStatusCode, string> = {
  order_placed: "Your order has been received.",
  confirmed: "Your order is confirmed.",
  manufacturing: "Your order is being prepared.",
  assembly: "Products are being assembled.",
  packing: "Your order is being packed.",
  invoice_generated: "Your invoice has been prepared.",
  dispatched: "Your order has left our facility.",
  in_transit: "Your order is on the way.",
  delivered: "Delivery has been completed.",
  support_window_active: "Post-delivery support is available.",
  complaint_under_review: "We are reviewing your concern.",
  resolved: "Your concern has been resolved.",
};

/** Primary journey order (complaint statuses overlay separately). */
export const CUSTOMER_JOURNEY_ORDER: CustomerTimelineStatusCode[] = [
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
];

export function buildStepCatalog(activeCode: CustomerTimelineStatusCode): CustomerTimelineStepProjection[] {
  const activeIdx = CUSTOMER_JOURNEY_ORDER.indexOf(activeCode);
  const idx = activeIdx >= 0 ? activeIdx : 0;
  return CUSTOMER_JOURNEY_ORDER.map((code, i) => ({
    code,
    label: CUSTOMER_STATUS_PUBLIC_LABELS[code],
    description: CUSTOMER_STATUS_DESCRIPTIONS[code],
    active: code === activeCode,
    completed: i < idx,
    completedAt: null,
  }));
}

export function statusIndex(code: CustomerTimelineStatusCode): number {
  const i = CUSTOMER_JOURNEY_ORDER.indexOf(code);
  return i >= 0 ? i : 0;
}

export function maxStatus(a: CustomerTimelineStatusCode, b: CustomerTimelineStatusCode): CustomerTimelineStatusCode {
  return statusIndex(a) >= statusIndex(b) ? a : b;
}
