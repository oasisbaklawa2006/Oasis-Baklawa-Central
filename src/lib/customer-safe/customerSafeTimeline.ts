import type { TimelineVisibilityClass } from "@/lib/operational-timeline/timelineVisibility";
import type { RawTimelineEventInput } from "@/lib/operational-timeline/timelineEntityProjection";
import { projectOperationalTimeline } from "@/lib/operational-timeline/timelineEntityProjection";
import { CUSTOMER_SAFE_WHITELISTED_VISIBILITY, isSuppressedInternalLabel } from "./customerSafeStatus";

export interface CustomerSafeTimelineStep {
  id: string;
  at: string;
  label: string;
  detail?: string;
}

export function isCustomerSafeVisibilityClass(visibilityClass: TimelineVisibilityClass): boolean {
  return CUSTOMER_SAFE_WHITELISTED_VISIBILITY.has(visibilityClass);
}

export function filterCustomerSafeTimelineInputs(inputs: RawTimelineEventInput[]): RawTimelineEventInput[] {
  return inputs
    .filter((e) => isCustomerSafeVisibilityClass(e.visibilityClass))
    .filter((e) => !isSuppressedInternalLabel(e.title) && !(e.summary && isSuppressedInternalLabel(e.summary)))
    .map((e) => ({
      ...e,
      visibilityClass: "public_curated" as const,
      title: sanitizeCustomerLabel(e.title),
      summary: e.summary ? sanitizeCustomerLabel(e.summary) : undefined,
    }));
}

export function sanitizeCustomerLabel(text: string): string {
  let out = text;
  const stripTerms = [
    "finance hold",
    "finance",
    "panic",
    "urgent",
    "escalation",
    "governance",
    "CMD",
    "owner",
    "department",
    "blocker",
    "internal",
    "staff",
    "hod",
    "manager",
  ];
  for (const bad of stripTerms) {
    out = out.replace(new RegExp(bad, "gi"), "");
  }
  out = out.replace(/\s{2,}/g, " ").trim();
  return out || "Update in progress";
}

export function projectCustomerSafeTimeline(inputs: RawTimelineEventInput[]): CustomerSafeTimelineStep[] {
  const filtered = filterCustomerSafeTimelineInputs(inputs);
  const projection = projectOperationalTimeline("customer_safe", filtered);
  return projection.events.map((e) => ({
    id: e.id,
    at: e.at,
    label: e.title,
    detail: e.summary,
  }));
}
