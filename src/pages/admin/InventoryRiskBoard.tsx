import { useEffect, useMemo, useState } from "react";
import { AlertOctagon, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { OperationalTimeline } from "@/components/admin/OperationalTimeline";
import { dedupeOperationalEventsById, mergeOperationalEventFeeds } from "@/lib/operational-events/normalize";
import { buildInventoryOsOperationalFeed } from "@/lib/operational-events/inventoryOperationalFeed";
import { buildExecutionOperationalFeed } from "@/lib/operational-events/executionOperationalFeed";
import { supabase } from "@/integrations/supabase/client";
import { isReservationOpen } from "@/lib/inventory-reservations/reservationLifecycle";
import type { ReservationStatus } from "@/lib/inventory-reservations/reservationTypes";

export default function InventoryRiskBoard() {
  const [openReservationSignals, setOpenReservationSignals] = useState(0);
  const [reservationSignalLoading, setReservationSignalLoading] = useState(true);
  const [reservationSignalError, setReservationSignalError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadOpenReservationCount() {
      setReservationSignalLoading(true);
      setReservationSignalError(null);
      const { data, error } = await supabase.from("inventory_reservations").select("reservation_status");
      if (cancelled) return;
      if (error) {
        setReservationSignalError(error.message);
        setReservationSignalLoading(false);
        return;
      }
      const openCount = (data ?? []).filter((row) =>
        isReservationOpen(row.reservation_status as ReservationStatus),
      ).length;
      setOpenReservationSignals(openCount);
      setReservationSignalLoading(false);
    }
    void loadOpenReservationCount();
    return () => {
      cancelled = true;
    };
  }, []);

  const events = useMemo(
    () =>
      dedupeOperationalEventsById(
        mergeOperationalEventFeeds([
          buildInventoryOsOperationalFeed({
            risk: {
              shelfTruthUnknown: true,
              openReservationSignals: reservationSignalLoading ? 0 : openReservationSignals,
              reconciliationBacklogHint: false,
            },
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
    [openReservationSignals, reservationSignalLoading],
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 pb-24">
      <header className="flex flex-wrap items-center gap-2 border-b border-border pb-4">
        <AlertOctagon className="h-7 w-7 text-primary" aria-hidden />
        <h1 className="text-xl font-bold tracking-tight">Inventory risk board</h1>
        <Badge variant="outline" className="text-[10px] uppercase">
          Internal preview — not fully live
        </Badge>
      </header>
      <p className="text-xs text-muted-foreground">
        Open reservation signals below are live from <code>inventory_reservations</code>. Shelf truth and
        reconciliation backlog hints remain honest static flags until those signals are wired.
      </p>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            Live reservation signal
            {reservationSignalLoading && (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" aria-hidden />
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          {reservationSignalError ? (
            <p className="text-destructive">Failed to load reservation signal: {reservationSignalError}</p>
          ) : reservationSignalLoading ? (
            <p className="text-muted-foreground">Loading open reservation count…</p>
          ) : (
            <p>
              <span className="text-2xl font-bold">{openReservationSignals}</span>{" "}
              <span className="text-muted-foreground">
                open reservation{openReservationSignals === 1 ? "" : "s"} (pending / reserved / partially_reserved /
                blocked)
              </span>
            </p>
          )}
        </CardContent>
      </Card>
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
