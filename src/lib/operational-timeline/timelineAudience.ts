export const TIMELINE_AUDIENCES = [
  "internal_full",
  "operational",
  "finance",
  "dispatch",
  "customer_safe",
] as const;

export type TimelineAudience = (typeof TIMELINE_AUDIENCES)[number];

export function audienceIncludesInternal(audience: TimelineAudience): boolean {
  return audience === "internal_full" || audience === "operational";
}

export function isCustomerSafeAudience(audience: TimelineAudience): boolean {
  return audience === "customer_safe";
}
