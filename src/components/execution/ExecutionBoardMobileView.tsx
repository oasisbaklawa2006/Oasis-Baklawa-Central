import { useMemo, useState } from "react";
import type { ExecutionBoardCardModel, ExecutionBoardLanes } from "@/lib/execution-boards/executionBoardProjection";
import { Badge } from "@/components/ui/badge";
import { ExecutionQueueCard } from "./ExecutionQueueCard";

const LANE_KEYS = ["queue", "blocked", "escalated", "aging", "unowned", "completedToday"] as const;

const LANE_LABELS: Record<(typeof LANE_KEYS)[number], string> = {
  queue: "Queue",
  blocked: "Blocked",
  escalated: "Escalated",
  aging: "Aging",
  unowned: "Unowned",
  completedToday: "Done",
};

export function ExecutionBoardMobileView({
  lanes,
  selectedId,
  onSelect,
}: {
  lanes: ExecutionBoardLanes;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [laneFilter, setLaneFilter] = useState<(typeof LANE_KEYS)[number] | "all">("all");

  const cards: ExecutionBoardCardModel[] = useMemo(() => {
    if (laneFilter === "all") {
      return [...lanes.queue, ...lanes.blocked, ...lanes.escalated, ...lanes.aging, ...lanes.unowned];
    }
    return lanes[laneFilter];
  }, [lanes, laneFilter]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3" data-testid="execution-board-mobile">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Queue lane filters">
        <Badge
          variant={laneFilter === "all" ? "default" : "outline"}
          className="min-h-[36px] cursor-pointer px-3 py-1 text-sm"
          onClick={() => setLaneFilter("all")}
        >
          All
        </Badge>
        {LANE_KEYS.map((key) => (
          <Badge
            key={key}
            variant={laneFilter === key ? "default" : "outline"}
            className="min-h-[36px] cursor-pointer px-3 py-1 text-sm"
            onClick={() => setLaneFilter(key)}
          >
            {LANE_LABELS[key]} ({lanes[key].length})
          </Badge>
        ))}
      </div>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto pb-24">
        {cards.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">No items in this lane.</p>
        ) : (
          cards.map((c) => (
            <ExecutionQueueCard
              key={c.item.id}
              model={c}
              selected={selectedId === c.item.id}
              onSelect={() => onSelect(c.item.id)}
              largeTouch
            />
          ))
        )}
      </div>
    </div>
  );
}
