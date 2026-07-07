import { useMemo } from "react";
import { AlertOctagon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { OperationalTimeline } from "@/components/admin/OperationalTimeline";
import { dedupeOperationalEventsById, mergeOperationalEventFeeds } from "@/lib/operational-events/normalize";
import { buildInventoryOsOperationalFeed } from "@/lib/operational-events/inventoryOperationalFeed";
import { buildExecutionOperationalFeed } from "@/lib/operational-events/executionOperationalFeed";

export default function InventoryRiskBoard() {
  const events = useMemo(
    () =>
      dedupeOperationalEventsById(
        mergeOperationalEventFeeds([
          buildInventoryOsOperationalFeed({
            risk: { shelfTruthUnknown: true, openReservationSignals: 0, reconciliationBacklogHint: false },
          }),
          buildExecutionOperationalFeed({
            satisfaction: {
              financeVerified: false,
              productionReady: true,
              packingComplete: false,
              barcodeReady: false,
              dispatchLabelReady: false,
            },
          }),
        ]),
      ),
    [],
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 pb-24">
      <header className="flex flex-wrap items-center gap-2 border-b border-border pb-4">
        <AlertOctagon className="h-7 w-7 text-primary" aria-hidden />
        <h1 className="text-xl font-bold tracking-tight">Inventory risk board</h1>
        <Badge variant="outline" className="text-[10px] uppercase">
          Internal preview — not connected to live data
        </Badge>
      </header>
      <p className="text-xs text-muted-foreground">
        Feed uses honest flags only (e.g. shelf truth unknown). Reservation counts and reconciliation backlog hints stay off
        until real signals are wired.
      </p>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Escalation projections</CardTitle>
        </CardHeader>
        <CardContent>
          <OperationalTimeline events={events} showFilters={false} defaultFilter="all" ariaLabel="Inventory risk timeline" />
        </CardContent>
      </Card>
    </div>
  );
}
