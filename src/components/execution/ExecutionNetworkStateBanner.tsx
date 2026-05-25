import { Clock, RefreshCw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  EXECUTION_POLL_INTERVAL_MS,
  EXECUTION_UX_LABELS,
} from "@/lib/execution-ux/executionUxConstants";

export function ExecutionNetworkStateBanner({
  lastLoadedAt,
  isStale,
  loading,
  versionConflict,
  onRefresh,
}: {
  lastLoadedAt: string | null;
  isStale: boolean;
  loading: boolean;
  versionConflict: boolean;
  onRefresh: () => void;
}) {
  if (!lastLoadedAt && !isStale && !versionConflict) return null;

  const staleOrConflict = isStale || versionConflict;
  const message = versionConflict
    ? EXECUTION_UX_LABELS.versionConflict
    : isStale
      ? EXECUTION_UX_LABELS.staleData
      : null;

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-xs ${
        staleOrConflict
          ? "border-amber-500/50 bg-amber-500/10 text-amber-950 dark:text-amber-100"
          : "border-border bg-muted/30 text-muted-foreground"
      }`}
      role="status"
    >
      <div className="flex flex-wrap items-center gap-2">
        {staleOrConflict ? (
          <WifiOff className="h-4 w-4 shrink-0" aria-hidden />
        ) : (
          <Clock className="h-4 w-4 shrink-0" aria-hidden />
        )}
        <span>
          {message ?? (
            <>
              {EXECUTION_UX_LABELS.lastRefreshed}:{" "}
              {new Date(lastLoadedAt!).toLocaleTimeString()} · {EXECUTION_UX_LABELS.pollingEvery}{" "}
              {Math.round(EXECUTION_POLL_INTERVAL_MS / 1000)}s
            </>
          )}
        </span>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-h-[44px] min-w-[44px]"
        onClick={onRefresh}
        disabled={loading}
        aria-label={EXECUTION_UX_LABELS.retryLoad}
      >
        <RefreshCw className={`mr-1 h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden />
        {EXECUTION_UX_LABELS.retryLoad}
      </Button>
    </div>
  );
}
