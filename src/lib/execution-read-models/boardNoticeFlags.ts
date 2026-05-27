import { isPreviewFallbackEnabled } from "./previewFallback";
import type { ProjectionSource } from "./types";

export interface GovernanceBoardNoticeFlags {
  showPreviewCards: boolean;
  showEmptyLiveMessage: boolean;
  showUnavailableMessage: boolean;
}

/** Pure notice flags for governance boards (testable without React). */
export function deriveGovernanceBoardNoticeFlags(params: {
  liveRowCount: number;
  loading: boolean;
  loadError: string | null;
  readModelSource: ProjectionSource | undefined;
}): GovernanceBoardNoticeFlags {
  const { liveRowCount, loading, loadError, readModelSource } = params;
  const unavailable = readModelSource === "unavailable";

  return {
    showPreviewCards:
      liveRowCount === 0 && isPreviewFallbackEnabled() && !loading && !loadError && !unavailable,
    showEmptyLiveMessage:
      liveRowCount === 0 && !isPreviewFallbackEnabled() && !loading && !loadError && !unavailable,
    showUnavailableMessage: liveRowCount === 0 && !loading && !loadError && unavailable,
  };
}
