/** Phase 3H — customer-safe timeline derived from operational_events only. */

export const CUSTOMER_TIMELINE_STATUS_CODES = [
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
] as const;

export type CustomerTimelineStatusCode = (typeof CUSTOMER_TIMELINE_STATUS_CODES)[number];

export type ComplaintState = "none" | "under_review" | "resolved";

export interface CustomerTimelineStepProjection {
  code: CustomerTimelineStatusCode;
  label: string;
  description: string;
  active: boolean;
  completed: boolean;
  completedAt: string | null;
}

export interface CustomerTimelineMappingExplanation {
  eventType: string;
  mappedTo: CustomerTimelineStatusCode | null;
  reason: string;
  suppressed: boolean;
}

export interface CustomerTimelineProjectionResult {
  orderId: string;
  currentStatus: CustomerTimelineStatusCode;
  steps: CustomerTimelineStepProjection[];
  progressPercent: number;
  lastPublicUpdateAt: string | null;
  estimatedNextStepLabel: string | null;
  safeDetail: string | null;
  supportWindowEndsAt: string | null;
  complaintState: ComplaintState;
  suppressedEventCount: number;
  mappingExplanations: CustomerTimelineMappingExplanation[];
  /** Staff preview only — never in public contract. */
  derivedFromEventCount: number;
}
