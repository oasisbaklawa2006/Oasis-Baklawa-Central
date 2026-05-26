import type { ExecutionBoardCardModel } from "@/lib/execution-boards/executionBoardProjection";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExecutionRiskBadge } from "./ExecutionRiskBadge";
import { ExecutionReservationBadge } from "./ExecutionReservationBadge";
import { ExecutionScanStatus } from "./ExecutionScanStatus";
import { ExecutionSlaBadge } from "./ExecutionSlaBadge";

export function ExecutionQueueCard({
  model,
  selected,
  onSelect,
  largeTouch,
}: {
  model: ExecutionBoardCardModel;
  selected: boolean;
  onSelect: () => void;
  largeTouch?: boolean;
}) {
  const { item } = model;
  return (
    <Card
      className={`cursor-pointer border-2 transition-colors ${selected ? "border-primary" : "border-border/80"} ${largeTouch ? "min-h-[88px]" : ""}`}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onSelect()}
    >
      <CardHeader className="p-3 pb-1">
        <CardTitle className="line-clamp-2 text-sm font-semibold">{item.title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-1 p-3 pt-0 text-[10px] text-muted-foreground">
        <ExecutionSlaBadge severity={model.slaSeverity} />
        <span className="rounded bg-muted px-1.5 py-0.5 uppercase">{item.state}</span>
        {item.escalationLevel !== "none" ? (
          <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-900 dark:text-amber-100">
            {item.escalationLevel}
          </span>
        ) : null}
        <ExecutionScanStatus status={model.latestScanStatus} issue={model.scanIssue} />
        <ExecutionRiskBadge internal={model.customerRiskInternal} />
        <ExecutionReservationBadge indicator={model.reservationIndicator} />
      </CardContent>
    </Card>
  );
}
