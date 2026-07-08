import { useEffect, useMemo, useState } from "react";
import { AlertOctagon, Loader2 } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { OperationalTimeline } from "@/components/admin/OperationalTimeline";
import { dedupeOperationalEventsById, mergeOperationalEventFeeds } from "@/lib/operational-events/normalize";
import { buildInventoryOsOperationalFeed } from "@/lib/operational-events/inventoryOperationalFeed";
import { buildExecutionOperationalFeed } from "@/lib/operational-events/executionOperationalFeed";
import { supabase } from "@/integrations/supabase/client";
import { isReservationOpen } from "@/lib/inventory-reservations/reservationLifecycle";
import { RESERVATION_STATUSES } from "@/lib/inventory-reservations/reservationTypes";

// Event id emitted by buildInventoryOsOperationalFeed only when a real (loaded) reservation count is fed in.
const RESERVATION_QUEUE_EVENT_ID = "inv-os:variance:inv-risk:reservation-queue";
const OPEN_RESERVATION_STATUSES = RESERVATION_STATUSES.filter(isReservationOpen);
// The generated Supabase Database type doesn't include inventory_reservations in its table union yet
// (same gap other read paths work around, e.g. useDepartmentExecutionBoard.ts). Narrowly escape typing
// for this one read-only count query only — do not widen this cast to any other call in this file.
const reservationsDb = supabase as unknown as SupabaseClient;

export default function InventoryRiskBoard() {
  // null = not yet successfully loaded (loading or error) — never treated as a real "0 signals" result.
  const [openReservationSignals, setOpenReservationSignals] = useState<number | null>(null);
  const [reservationSignalLoading, setReservationSignalLoading] = useState(true);
  const [reservationSignalError, setReservationSignalError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadOpenReservationCount() {
      setReservationSignalLoading(true);
      setReservationSignalError(null);
      const { count, error } = await reservationsDb
        .from("inventory_reservations")
        .select("id", { count: "exact", head: true })
        .in("reservation_status", OPEN_RESERVATION_STATUSES);
      if (cancelled) return;
      if (error) {
        setOpenReservationSignals(null);
        setReservationSignalError(error.message);
        setReservationSignalLoading(false);
        return;
      }
      if (count === null) {
        setOpenReservationSignals(null);
        setReservationSignalError("Reservation count unavailable.");
        setReservationSignalLoading(false);
        return;
      }
      setOpenReservationSignals(count);
      setReservationSignalLoading(false);
    }
    void loadOpenReservationCount();
    return () => {
      cancelled = true;
    };
  }, []);

  const reservationSignalReady = !reservationSignalLoading && !reservationSignalError && openReservationSignals !== null;

  const events = useMemo(() => {
    const merged = dedupeOperationalEventsById(
      mergeOperationalEventFeeds([
        buildInventoryOsOperationalFeed({
          risk: {
            shelfTruthUnknown: true,
            // Only a successfully-loaded count is ever a real signal; otherwise feed 0 but strip its derived
            // event below so an unresolved/failed fetch can never be mistaken for a confirmed "no risk" result.
            openReservationSignals: reservationSignalReady ? (openReservationSignals as number) : 0,
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
    );
    return reservationSignalReady ? merged : merged.filter((event) => event.id !== RESERVATION_QUEUE_EVENT_ID);
  }, [openReservationSignals, reservationSignalReady]);

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
            <p className="text-destructive">Reservation signal unavailable: {reservationSignalError}</p>
          ) : reservationSignalLoading || openReservationSignals === null ? (
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
