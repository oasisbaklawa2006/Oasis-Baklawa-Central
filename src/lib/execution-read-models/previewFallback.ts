/**
 * Production preview cards require explicit opt-in.
 */

export function isPreviewFallbackEnabled(): boolean {
  return (
    typeof import.meta !== "undefined" &&
    import.meta.env?.VITE_EXECUTION_PREVIEW_FALLBACK === "true"
  );
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
