import type { ExecutionBoardCardModel, ExecutionBoardLanes } from "@/lib/execution-boards/executionBoardProjection";
import { ExecutionQueueCard } from "./ExecutionQueueCard";

function LaneColumn({
  title,
  cards,
  selectedId,
  onSelect,
}: {
  title: string;
  cards: ExecutionBoardCardModel[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="min-w-[220px] flex-1 rounded-lg border border-border/80 bg-muted/20 p-2">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title} ({cards.length})
      </h3>
      <div className="flex max-h-[70vh] flex-col gap-2 overflow-y-auto">
        {cards.map((c) => (
          <ExecutionQueueCard
            key={c.item.id}
            model={c}
            selected={selectedId === c.item.id}
            onSelect={() => onSelect(c.item.id)}
          />
        ))}
      </div>
    </div>
  );
}

export function ExecutionQueueBoard({
  lanes,
  selectedId,
  onSelect,
}: {
  lanes: ExecutionBoardLanes;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      <LaneColumn title="Queue" cards={lanes.queue} selectedId={selectedId} onSelect={onSelect} />
      <LaneColumn title="Blocked" cards={lanes.blocked} selectedId={selectedId} onSelect={onSelect} />
      <LaneColumn title="Escalated" cards={lanes.escalated} selectedId={selectedId} onSelect={onSelect} />
      <LaneColumn title="Aging" cards={lanes.aging} selectedId={selectedId} onSelect={onSelect} />
      <LaneColumn title="Unowned" cards={lanes.unowned} selectedId={selectedId} onSelect={onSelect} />
      <LaneColumn title="Done today" cards={lanes.completedToday} selectedId={selectedId} onSelect={onSelect} />
    </div>
  );
}
