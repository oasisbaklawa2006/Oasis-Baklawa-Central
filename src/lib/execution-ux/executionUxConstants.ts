/** Shared Execution OS UX constants — translation-ready labels. */

export const EXECUTION_UX_LABELS = {
  internalOnly: "Internal only — not visible to customers",
  staleData: "Data may be stale. Refresh before acting.",
  versionConflict: "This queue was updated by someone else. Refresh required.",
  lastRefreshed: "Last refreshed",
  pollingEvery: "Auto-refresh every",
  retryLoad: "Retry load",
  tvReadOnly: "TV display mode — read only",
  scannerReady: "Scanner ready — scan or type barcode",
  confirmAction: "Confirm operational action",
  noMutationsTv: "Actions disabled in TV mode",
} as const;

export const EXECUTION_POLL_INTERVAL_MS = 45_000;
export const EXECUTION_STALE_THRESHOLD_MS = 67_500;
export const EXECUTION_TOUCH_MIN_PX = 44;

export type ExecutionDisplayMode = "desktop" | "mobile" | "tv";
