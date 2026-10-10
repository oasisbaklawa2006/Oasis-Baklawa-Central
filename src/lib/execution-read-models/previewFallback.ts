/**
 * Production preview cards require explicit opt-in (staging only).
 */

import {
  assertAuthorityAvailable,
  isDemoFallbackPermitted,
  resolveAuthorityAvailability,
} from "@/lib/integration-contracts";

export function isPreviewFallbackEnabled(): boolean {
  return isDemoFallbackPermitted();
}

export function resolveBoardProjectionSource(
  liveRowCount: number,
  tablesAvailable: boolean,
  loadError?: unknown,
): import("./types").ProjectionSource {
  if (!tablesAvailable) return "unavailable";
  if (liveRowCount > 0) return "live";
  if (isPreviewFallbackEnabled()) return "preview";
  return "empty";
}

/** Fail closed when governance read-model authority is unavailable (no preview substitution). */
export function assertGovernanceBoardAuthority(
  tablesAvailable: boolean,
  loadError?: unknown,
  source = "governance-board",
): void {
  assertAuthorityAvailable(resolveAuthorityAvailability(tablesAvailable, loadError), source);
}
