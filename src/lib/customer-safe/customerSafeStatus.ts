export type CustomerSafeStatusCode =
  | "order_received"
  | "in_preparation"
  | "quality_check"
  | "ready_for_dispatch"
  | "in_transit"
  | "delivered"
  | "support_window";

export interface CustomerSafeStatus {
  code: CustomerSafeStatusCode;
  label: string;
  description: string;
  active: boolean;
  completed: boolean;
}

export const CUSTOMER_SAFE_STATUS_CATALOG: CustomerSafeStatus[] = [
  { code: "order_received", label: "Order received", description: "We have received your order.", active: false, completed: false },
  { code: "in_preparation", label: "In preparation", description: "Your order is being prepared.", active: false, completed: false },
  { code: "quality_check", label: "Quality check", description: "Quality review in progress.", active: false, completed: false },
  { code: "ready_for_dispatch", label: "Ready for dispatch", description: "Preparing for dispatch.", active: false, completed: false },
  { code: "in_transit", label: "In transit", description: "Your order is on the way.", active: false, completed: false },
  { code: "delivered", label: "Delivered", description: "Delivery completed.", active: false, completed: false },
  { code: "support_window", label: "Support window", description: "Post-delivery support is available.", active: false, completed: false },
];

/** Explicit whitelist — only these visibility classes may reach customer_safe (no operational/internal). */
export const CUSTOMER_SAFE_WHITELISTED_VISIBILITY = new Set(["public_curated"]);

const SUPPRESSED_INTERNAL_LABELS = [
  "finance hold",
  "finance",
  "governance",
  "panic",
  "urgent",
  "escalation",
  "dispute",
  "waste",
  "duplicate",
  "shadow",
  "cmd",
  "blocked lane",
  "blocker",
  "owner",
  "department",
  "hod",
  "manager",
  "incharge",
  "accountability",
  "hold",
  "verification pending",
  "internal",
  "staff",
  "war room",
  "triage",
];

export function isSuppressedInternalLabel(text: string): boolean {
  const lower = text.toLowerCase();
  return SUPPRESSED_INTERNAL_LABELS.some((s) => lower.includes(s));
}
