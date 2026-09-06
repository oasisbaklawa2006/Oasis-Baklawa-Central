import type { RealtimeTransportStatus } from "./types";

const TERMINAL_DEGRADED: RealtimeTransportStatus[] = ["degraded", "unavailable"];

export function isRealtimeTransportDegraded(status: RealtimeTransportStatus): boolean {
  return TERMINAL_DEGRADED.includes(status);
}

export function canApplyRealtimeDelta(status: RealtimeTransportStatus): boolean {
  return status === "subscribed" || status === "degraded";
}

export function shouldRunPollingFallback(
  status: RealtimeTransportStatus,
  pollingFallbackMs: number | undefined,
): boolean {
  return pollingFallbackMs != null && pollingFallbackMs > 0 && isRealtimeTransportDegraded(status);
}

export function nextStatusAfterSnapshot(
  current: RealtimeTransportStatus,
): RealtimeTransportStatus {
  if (current === "snapshot_loading") return "snapshot_ready";
  if (current === "degraded") return "snapshot_ready";
  return current;
}

export function nextStatusAfterSubscribeSuccess(): RealtimeTransportStatus {
  return "subscribed";
}

export function nextStatusAfterChannelFailure(
  attempts: number,
  maxAttempts: number,
): RealtimeTransportStatus {
  return attempts >= maxAttempts ? "unavailable" : "degraded";
}
