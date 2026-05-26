import type { RawTimelineEventInput } from "@/lib/operational-timeline/timelineEntityProjection";
import { filterCustomerSafeTimelineInputs, sanitizeCustomerLabel } from "./customerSafeTimeline";
import { isSuppressedInternalLabel } from "./customerSafeStatus";

export type CustomerTimelineStepCode =
  | "order_placed"
  | "confirmed"
  | "manufacturing"
  | "assembly"
  | "packing"
  | "invoice_generated"
  | "dispatched"
  | "in_transit"
  | "delivered"
  | "support_window";

export interface CustomerTimelineStep {
  code: CustomerTimelineStepCode;
  label: string;
  description: string;
  active: boolean;
  completed: boolean;
}

export const CUSTOMER_TIMELINE_STEP_CATALOG: CustomerTimelineStep[] = [
  { code: "order_placed", label: "Order Placed", description: "Your order has been received.", active: false, completed: false },
  { code: "confirmed", label: "Confirmed", description: "Your order is confirmed.", active: false, completed: false },
  { code: "manufacturing", label: "Manufacturing", description: "Your order is being prepared.", active: false, completed: false },
  { code: "assembly", label: "Assembly", description: "Products are being assembled.", active: false, completed: false },
  { code: "packing", label: "Packing", description: "Your order is being packed.", active: false, completed: false },
  { code: "invoice_generated", label: "Invoice Generated", description: "Invoice has been prepared.", active: false, completed: false },
  { code: "dispatched", label: "Dispatched", description: "Your order has left our facility.", active: false, completed: false },
  { code: "in_transit", label: "In Transit", description: "Your order is on the way.", active: false, completed: false },
  { code: "delivered", label: "Delivered", description: "Delivery completed.", active: false, completed: false },
  {
    code: "support_window",
    label: "10-day support window",
    description: "Post-delivery support is available.",
    active: false,
    completed: false,
  },
];

const STATUS_TO_STEP: Record<string, CustomerTimelineStepCode> = {
  draft: "order_placed",
  cart: "order_placed",
  submitted: "confirmed",
  manufacturing: "manufacturing",
  in_production: "manufacturing",
  assembly: "assembly",
  partial_ready: "assembly",
  packed_ready: "packing",
  awaiting_final_payment: "invoice_generated",
  awaiting_payment: "invoice_generated",
  cleared_for_dispatch: "dispatched",
  dispatched: "dispatched",
  in_transit: "in_transit",
  delivered: "delivered",
  closed: "delivered",
};

const FORBIDDEN_OUTPUT_TERMS = [
  "finance hold",
  "escalation",
  "governance",
  "panic",
  "owner",
  "department",
  "cmd",
  "blocker",
  "internal",
  "staff",
  "accountability",
  "hod",
  "manager",
  "verification pending",
];

export interface CustomerTimelineProjectionInput {
  orderStatus: string;
  timelineEvents?: RawTimelineEventInput[];
}

export interface CustomerTimelineProjection {
  steps: CustomerTimelineStep[];
  curatedEvents: ReturnType<typeof filterCustomerSafeTimelineInputs>;
  activeStep: CustomerTimelineStepCode;
}

export function mapOrderStatusToTimelineStep(status: string): CustomerTimelineStepCode {
  const st = (status || "").toLowerCase();
  return STATUS_TO_STEP[st] ?? "order_placed";
}

export function projectCustomerTimeline(input: CustomerTimelineProjectionInput): CustomerTimelineProjection {
  const activeStep = mapOrderStatusToTimelineStep(input.orderStatus);
  const order = CUSTOMER_TIMELINE_STEP_CATALOG.map((s) => s.code);
  const activeIdx = order.indexOf(activeStep);

  const steps = CUSTOMER_TIMELINE_STEP_CATALOG.map((s, idx) => ({
    ...s,
    active: s.code === activeStep,
    completed: idx < activeIdx,
  }));

  const curatedEvents = filterCustomerSafeTimelineInputs(input.timelineEvents ?? []);

  for (const step of steps) {
    if (containsForbiddenTerm(step.label) || containsForbiddenTerm(step.description)) {
      throw new Error(`Customer timeline step contains suppressed term: ${step.code}`);
    }
  }
  for (const ev of curatedEvents) {
    if (containsForbiddenTerm(ev.title) || (ev.summary && containsForbiddenTerm(ev.summary))) {
      throw new Error(`Customer timeline event contains suppressed term: ${ev.id}`);
    }
  }

  return { steps, curatedEvents, activeStep };
}

export function containsForbiddenTerm(text: string): boolean {
  const sanitized = sanitizeCustomerLabel(text).toLowerCase();
  if (isSuppressedInternalLabel(text)) return true;
  return FORBIDDEN_OUTPUT_TERMS.some((t) => sanitized.includes(t) && sanitized.length < text.length + 5);
}
