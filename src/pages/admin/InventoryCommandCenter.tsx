import { useMemo } from "react";
import { Warehouse } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { OperationalTimeline } from "@/components/admin/OperationalTimeline";
import { mergeOperationalEventFeeds, dedupeOperationalEventsById } from "@/lib/operational-events/normalize";
import { buildInventoryOsOperationalFeed } from "@/lib/operational-events/inventoryOperationalFeed";
import { buildExecutionOperationalFeed } from "@/lib/operational-events/executionOperationalFeed";
import { buildGovernanceOperationalFeed } from "@/lib/operational-events/governanceOperationalFeed";
import { buildBarcodeOperationalFeed } from "@/lib/operational-events/barcodeOperationalFeed";

/**
 * Inventory command center — merged projections only (no stock edits, no scanner I/O).
 */
export default function InventoryCommandCenter() {
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
              productionReady: false,
              packingComplete: false,
              barcodeReady: false,
              dispatchLabelReady: false,
            },
          }),
          buildGovernanceOperationalFeed({ escalationTopics: [] }),
          buildBarcodeOperationalFeed({ scans: [], financeReleased: true }),
        ]),
      ),
    [],
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 pb-24">
      <header className="flex flex-wrap items-center gap-2 border-b border-border pb-4">
        <Warehouse className="h-7 w-7 text-primary" aria-hidden />
        <h1 className="text-xl font-bold tracking-tight">Inventory command center</h1>
        <Badge variant="outline" className="text-[10px] uppercase">
          Projections only
        </Badge>
      </header>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Merged operational intelligence</CardTitle>
          <CardDescription className="text-xs">
            Combines inventory OS, execution dependency, governance, and barcode scan windows. No silent mutations — wire real satisfaction flags from War Room in a later pass.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OperationalTimeline events={events} showFilters={false} defaultFilter="all" ariaLabel="Inventory command center timeline" />
        </CardContent>
      </Card>
    </div>
  );
}
