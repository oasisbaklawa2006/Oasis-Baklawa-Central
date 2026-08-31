import type { CustomerTimelineStep } from "@/components/customer/CustomerOrderTimeline";

const ORDER_STAGE_LABELS: Record<string, string> = {
  submitted: "Order received",
  so_created: "Sales order confirmed",
  awaiting_payment: "Payment update needed",
  finance_review: "Payment under review",
  finance_cleared: "Ready for preparation",
  in_production: "Being prepared",
  packing: "Being packed",
  dispatched: "Dispatched",
  in_transit: "On the way",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const PAYMENT_STAGE_LABELS: Record<string, string> = {
  awaiting_receipt: "Payment details needed",
  receipt_submitted: "Payment under review",
  verified: "Payment verified",
  cleared: "Payment cleared",
  rejected: "Payment update needed",
  not_required: "Payment not required",
};

const TIMELINE_RANK: Record<string, number> = {
  submitted: 1,
  so_created: 1,
  awaiting_payment: 2,
  finance_review: 2,
  finance_cleared: 3,
  in_production: 3,
  packing: 3,
  dispatched: 4,
  in_transit: 4,
  delivered: 5,
};

/** Converts a Core stage into plain customer language without exposing enums. */
export function customerOrderStageLabel(stage: string | null | undefined): string {
  return ORDER_STAGE_LABELS[(stage || "").toLowerCase()] || "Order in progress";
}

/** Converts a Core payment stage into a safe customer-facing label. */
export function customerPaymentStageLabel(stage: string | null | undefined): string {
  return PAYMENT_STAGE_LABELS[(stage || "").toLowerCase()] || "Payment status will appear when available";
}

/** Returns an action only for known payment states; unknown states fail closed. */
export function customerOrderAction(stage: string | null | undefined): string | null {
  const normalized = (stage || "").toLowerCase();
  if (normalized === "awaiting_receipt" || normalized === "rejected") return "Payment update needed";
  if (normalized === "receipt_submitted") return "Payment review in progress";
  return null;
}

/** Builds the presentation-only order pipeline from already safe Core fields. */
export function buildCustomerOrderTimeline(input: {
  customerStage: string | null | undefined;
  paymentStage: string | null | undefined;
  orderNumber: string | null | undefined;
}): CustomerTimelineStep[] {
  const stage = (input.customerStage || "").toLowerCase();
  const payment = (input.paymentStage || "").toLowerCase();
  const rank = TIMELINE_RANK[stage] ?? (input.orderNumber ? 1 : 0);
  const paymentRank = payment === "verified" || payment === "cleared" ? 3 : 2;
  const currentRank = Math.max(rank, paymentRank);
  const stateFor = (stepRank: number): CustomerTimelineStep["state"] => {
    if (stepRank < currentRank) return "completed";
    if (stepRank === currentRank) return "current";
    return "upcoming";
  };

  return [
    { id: "received", label: "Order received", state: "completed", caption: "Your request is safely with Oasis." },
    { id: "sales-order", label: "Sales order confirmed", state: stateFor(1) },
    { id: "payment", label: "Payment review", state: stateFor(2), caption: payment === "awaiting_receipt" ? "Add payment details when requested." : undefined },
    { id: "preparation", label: "Preparing your order", state: stateFor(3) },
    { id: "dispatch", label: "Dispatch", state: stateFor(4) },
    { id: "delivery", label: "Delivered", state: stateFor(5) },
  ];
}

/** Extracts safe, human-readable readiness messages without inventing quantities. */
export function customerReadinessMessages(
  readinessIssues: unknown,
  minimumQuantity: number | null | undefined,
  minimumUom: string | null | undefined,
): string[] {
  const values: string[] = [];
  const collect = (value: unknown) => {
    if (typeof value === "string" && value.trim()) values.push(value.trim());
    else if (Array.isArray(value)) value.forEach(collect);
    else if (value && typeof value === "object") {
      const record = value as Record<string, unknown>;
      collect(record.message);
      collect(record.detail);
      if (!record.message && !record.detail) collect(record.code);
    }
  };
  collect(readinessIssues);
  const normalized = values.map((value) => value.toLowerCase());
  if (normalized.some((value) => value.includes("moq") || value.includes("minimum")) && minimumQuantity) {
    return [`Minimum order is ${minimumQuantity} ${minimumUom || "units"}.`];
  }
  if (normalized.some((value) => value.includes("moq") || value.includes("minimum"))) {
    return ["Meet the minimum order quantity shown for this product."];
  }
  if (normalized.some((value) => value.includes("increment") || value.includes("carton"))) {
    return ["Adjust the quantity to the approved carton or order increment."];
  }
  return ["Review the quantity and carton requirements before submitting."];
}
