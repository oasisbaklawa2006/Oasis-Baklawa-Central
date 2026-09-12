/**
 * Frozen Wave 1 baseline invariants.
 *
 * Do not change without updating `.ai-intent/APPVERSE_WAVE1_BASELINE.md`
 * and recording a new baseline commit with validation evidence.
 *
 * @see .ai-intent/APPVERSE_WAVE1_BASELINE.md
 */
export const WAVE1_BASELINE_COMMIT = "6b18bc68e15ef469d9c240704dbfde0a15dbba10";

export const WAVE1_BASELINE_MERGE_PR = 324;

export const WAVE1_LAUNCHPAD_KEYS = [
  "orders-finance",
  "operations-production",
  "whatsapp-support",
] as const;

export const WAVE1_LAUNCHPAD_LANDING_PATHS = [
  "/admin/order-management",
  "/admin/live-work-queues",
  "/admin/operator-inbox",
] as const;

export const WAVE1_WORKSPACE_KEYS = [
  "home",
  "customers-sales",
  "orders-finance",
  "operations",
  "products-catalogue",
  "trace-dispatch",
  "governance",
] as const;

export const WAVE1_HOME_ROUTE = "/admin";
