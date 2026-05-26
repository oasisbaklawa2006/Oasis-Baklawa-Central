import type { OperationalEventVisibility } from "./operationalEventTypes";

/** public_candidate is a label only — not customer-published in Phase 3. */
export function isCustomerPublishedVisibility(_visibility: OperationalEventVisibility): boolean {
  return false;
}

export function normalizeEventVisibility(
  visibility?: OperationalEventVisibility,
): OperationalEventVisibility {
  if (visibility === "public_candidate" || visibility === "staff_only") return visibility;
  return "internal";
}

export function assertSafeEventMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (typeof value === "function") continue;
    if (key.toLowerCase().includes("password") || key.toLowerCase().includes("secret")) continue;
    safe[key] = value;
  }
  return safe;
}
