import type { ExecutionBoardLanes } from "@/lib/execution-boards/executionBoardProjection";
import { ExecutionStatusMarquee } from "./ExecutionStatusMarquee";
import { ExecutionSlaBadge } from "./ExecutionSlaBadge";
import { EXECUTION_UX_LABELS } from "@/lib/execution-ux/executionUxConstants";

function TvLane({
  title,
  cards,
}: {
  title: string;
  cards: ExecutionBoardLanes["queue"];
}) {
  return (
    <section className="rounded-xl border-2 border-border bg-card/80 p-4" aria-label={`${title} lane`}>
      <h2 className="mb-3 text-2xl font-bold uppercase tracking-wide text-muted-foreground md:text-3xl">
        {title} ({cards.length})
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.slice(0, 12).map((c) => (
          <li
            key={c.item.id}
            className="rounded-lg border border-border/80 bg-muted/30 p-4"
            aria-label={`Queue item ${c.item.state}`}
          >
            <p className="line-clamp-2 text-xl font-bold md:text-2xl">{c.item.title}</p>
            <div className="mt-2 flex flex-wrap gap-2 text-base">
              <ExecutionSlaBadge severity={c.slaSeverity} />
              <span className="rounded bg-muted px-2 py-1 font-medium uppercase">{c.item.state}</span>
              {c.scanIssue ? (
                <span className="rounded bg-amber-500/20 px-2 py-1 font-medium text-amber-950 dark:text-amber-100">
                  Scan attention
                </span>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Read-only TV board — no mutations, no sensitive customer/finance copy. */
export function ExecutionBoardTVView({
  lanes,
  lastLoadedAt,
}: {
  lanes: ExecutionBoardLanes;
  lastLoadedAt: string | null;
}) {
  return (
    <div className="space-y-6" data-testid="execution-board-tv">
      <p className="text-center text-lg font-medium text-muted-foreground md:text-xl" role="status">
        {EXECUTION_UX_LABELS.tvReadOnly}
        {lastLoadedAt ? ` · Updated ${new Date(lastLoadedAt).toLocaleTimeString()}` : ""}
      </p>
      <ExecutionStatusMarquee lanes={lanes} />
      <TvLane title="Queue" cards={lanes.queue} />
      <TvLane title="Blocked" cards={lanes.blocked} />
      <TvLane title="Escalated" cards={lanes.escalated} />
      <TvLane title="Unowned" cards={lanes.unowned} />
      <TvLane title="Aging" cards={lanes.aging} />
    </div>
  );
}
