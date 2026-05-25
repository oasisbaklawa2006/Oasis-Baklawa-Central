import type { ExecutionBoardLanes } from "@/lib/execution-boards/executionBoardProjection";

/** TV-friendly scrolling status strip — no customer PII, no finance wording. */
export function ExecutionStatusMarquee({ lanes }: { lanes: ExecutionBoardLanes }) {
  const parts: string[] = [];
  if (lanes.blocked.length) parts.push(`Blocked: ${lanes.blocked.length}`);
  if (lanes.escalated.length) parts.push(`Escalated: ${lanes.escalated.length}`);
  if (lanes.unowned.length) parts.push(`Unowned: ${lanes.unowned.length}`);
  if (lanes.aging.length) parts.push(`Aging: ${lanes.aging.length}`);
  const scanIssues = [...lanes.queue, ...lanes.blocked, ...lanes.escalated].filter((c) => c.scanIssue);
  if (scanIssues.length) parts.push(`Scan exceptions: ${scanIssues.length}`);

  if (!parts.length) return null;

  return (
    <div
      className="overflow-hidden rounded-md border border-border bg-muted/40 py-2"
      aria-live="polite"
      aria-label="Department pressure summary"
    >
      <div className="animate-marquee whitespace-nowrap px-4 text-lg font-semibold tracking-wide md:text-2xl">
        {parts.join(" · ")}
      </div>
    </div>
  );
}
