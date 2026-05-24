import type { TimelineAudience } from "./timelineAudience";

export type TimelineVisibilityClass =
  | "public_curated"
  | "operational"
  | "finance_internal"
  | "governance_internal"
  | "escalation_internal"
  | "suppressed";

export interface TimelineVisibilityRule {
  eventClass: TimelineVisibilityClass;
  allowedAudiences: TimelineAudience[];
}

export const TIMELINE_VISIBILITY_RULES: TimelineVisibilityRule[] = [
  { eventClass: "public_curated", allowedAudiences: ["customer_safe", "operational", "finance", "dispatch", "internal_full"] },
  { eventClass: "operational", allowedAudiences: ["operational", "dispatch", "internal_full"] },
  { eventClass: "finance_internal", allowedAudiences: ["finance", "internal_full"] },
  { eventClass: "governance_internal", allowedAudiences: ["internal_full"] },
  { eventClass: "escalation_internal", allowedAudiences: ["internal_full"] },
  { eventClass: "suppressed", allowedAudiences: [] },
];

export function isVisibleToAudience(eventClass: TimelineVisibilityClass, audience: TimelineAudience): boolean {
  const rule = TIMELINE_VISIBILITY_RULES.find((r) => r.eventClass === eventClass);
  return rule?.allowedAudiences.includes(audience) ?? false;
}
