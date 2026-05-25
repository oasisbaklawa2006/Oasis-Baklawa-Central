import { Link } from "react-router-dom";
import { LayoutGrid, Monitor, RefreshCw, Smartphone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExecutionInternalOnlyBanner } from "./ExecutionInternalOnlyBanner";
import { ExecutionNetworkStateBanner } from "./ExecutionNetworkStateBanner";
import { ExecutionPanicVisibilityStrip } from "./ExecutionPanicVisibilityStrip";
import type { ExecutionBoardLanes } from "@/lib/execution-boards/executionBoardProjection";
import type { ExecutionDisplayMode } from "@/lib/execution-ux/executionUxConstants";
import { EXECUTION_UX_LABELS } from "@/lib/execution-ux/executionUxConstants";

export function ExecutionResponsiveShell({
  title,
  mode,
  canWrite,
  loading,
  error,
  lastLoadedAt,
  isStale,
  versionConflict,
  lanes,
  onRefresh,
  tvHref,
  children,
}: {
  title: string;
  mode: ExecutionDisplayMode;
  canWrite: boolean;
  loading: boolean;
  error: string | null;
  lastLoadedAt: string | null;
  isStale: boolean;
  versionConflict: boolean;
  lanes: ExecutionBoardLanes;
  onRefresh: () => void;
  tvHref: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`flex h-full min-h-0 flex-col gap-3 p-3 md:gap-4 md:p-4 ${mode === "tv" ? "bg-background" : ""}`}
      data-execution-mode={mode}
    >
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <LayoutGrid className="h-6 w-6 text-primary md:h-7 md:w-7" aria-hidden />
          <h1 className={`font-bold tracking-tight ${mode === "tv" ? "text-2xl md:text-4xl" : "text-lg"}`}>
            {title}
          </h1>
          <Badge variant="outline" className="text-[10px] uppercase">
            {mode === "tv" ? "TV" : mode === "mobile" ? "Mobile" : "Board"}
          </Badge>
          {mode === "tv" ? (
            <Badge variant="secondary" className="text-[10px]">
              {EXECUTION_UX_LABELS.noMutationsTv}
            </Badge>
          ) : !canWrite ? (
            <Badge variant="secondary" className="text-[10px]">
              Read-only role
            </Badge>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {mode !== "tv" ? (
            <>
              <Button type="button" variant="outline" size="sm" className="min-h-[44px]" asChild>
                <Link to="/admin/execution-command-center">Command center</Link>
              </Button>
              <Button type="button" variant="outline" size="sm" className="min-h-[44px]" asChild>
                <Link to={tvHref}>
                  <Monitor className="mr-1 h-4 w-4" aria-hidden />
                  TV
                </Link>
              </Button>
            </>
          ) : (
            <Button type="button" variant="outline" size="sm" className="min-h-[44px]" asChild>
              <Link to={tvHref.replace("?display=tv", "").replace("&display=tv", "") || "."}>
                <Smartphone className="mr-1 h-4 w-4" aria-hidden />
                Exit TV
              </Link>
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-[44px]"
            onClick={onRefresh}
            disabled={loading}
            aria-label="Refresh board"
          >
            <RefreshCw className={`mr-1 h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden />
            Refresh
          </Button>
        </div>
      </header>

      <ExecutionInternalOnlyBanner
        extra={mode === "tv" ? "TV shows operational status only" : undefined}
      />
      <ExecutionNetworkStateBanner
        lastLoadedAt={lastLoadedAt}
        isStale={isStale}
        loading={loading}
        versionConflict={versionConflict}
        onRefresh={onRefresh}
      />
      {mode !== "tv" ? <ExecutionPanicVisibilityStrip lanes={lanes} /> : null}
      {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}
