import type { RawTimelineEventInput } from "@/lib/operational-timeline/timelineEntityProjection";
import { projectOperationalTimeline } from "@/lib/operational-timeline/timelineEntityProjection";
import { isSuppressedInternalLabel } from "./customerSafeStatus";

export interface CustomerSafeTimelineStep {
  id: string;
  at: string;
  label: string;
  detail?: string;
}

export function filterCustomerSafeTimelineInputs(inputs: RawTimelineEventInput[]): RawTimelineEventInput[] {
  return inputs.filter((e) => {
    if (e.visibilityClass === "governance_internal" || e.visibilityClass === "escalation_internal" || e.visibilityClass === "suppressed") {
      return false;
    }
    if (isSuppressedInternalLabel(e.title) || (e.summary && isSuppressedInternalLabel(e.summary))) {
      return false;
    }
    return e.visibilityClass === "public_curated" || e.visibilityClass === "operational";
  }).map((e) => ({
    ...e,
    visibilityClass: "public_curated" as const,
    title: sanitizeCustomerLabel(e.title),
    summary: e.summary ? sanitizeCustomerLabel(e.summary) : undefined,
  }));
}

export function sanitizeCustomerLabel(text: string): string {
  let out = text;
  for (const bad of ["finance hold", "panic", "escalation", "governance", "CMD"]) {
    out = out.replace(new RegExp(bad, "gi"), "");
  }
  return out.trim() || "Update in progress";
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
