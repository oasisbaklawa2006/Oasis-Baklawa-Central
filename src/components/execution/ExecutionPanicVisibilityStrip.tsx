import { AlertOctagon } from "lucide-react";
import type { ExecutionBoardLanes } from "@/lib/execution-boards/executionBoardProjection";

/** Highlights urgent operational pressure without exposing customer/finance detail. */
export function ExecutionPanicVisibilityStrip({ lanes }: { lanes: ExecutionBoardLanes }) {
  const urgent =
    lanes.escalated.length +
    lanes.blocked.filter((c) => c.slaSeverity === "breached" || c.slaSeverity === "critical").length;

  if (urgent === 0) return null;

  return (
    <div
      className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive"
      role="status"
      aria-label={`${urgent} urgent queue items need attention`}
    >
      <AlertOctagon className="h-5 w-5 shrink-0" aria-hidden />
      <span>
        {urgent} urgent item{urgent === 1 ? "" : "s"} — escalated or SLA breached
      </span>
    </div>
  );
}
