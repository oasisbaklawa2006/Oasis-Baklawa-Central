/**
 * Production preview cards require explicit opt-in (staging only).
 */

import { isDemoFallbackPermitted } from "@/lib/integration-contracts";

export function isPreviewFallbackEnabled(): boolean {
  return isDemoFallbackPermitted();
}

export function resolveBoardProjectionSource(
  liveRowCount: number,
  tablesAvailable: boolean,
): import("./types").ProjectionSource {
  if (!tablesAvailable) return "unavailable";
  if (liveRowCount > 0) return "live";
  if (isPreviewFallbackEnabled()) return "preview";
  return "empty";
}
