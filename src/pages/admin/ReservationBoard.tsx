import { useMemo } from "react";
import { ListOrdered } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ReservationLifecycleState } from "@/lib/inventory-operating-system/inventoryTypes";
import { RESERVATION_VALID_NEXT, reservationRequiresLocking } from "@/lib/inventory-operating-system/reservationLifecycle";
import { OperationalTimeline } from "@/components/admin/OperationalTimeline";
import { ReservationGovernancePanel } from "@/components/admin/ReservationGovernancePanel";
import { dedupeOperationalEventsById } from "@/lib/operational-events/normalize";
import { buildGovernanceOperationalFeed } from "@/lib/operational-events/governanceOperationalFeed";

/** Design-time lifecycle reference — persisted locks use governed panel below. */
const STATE_REFERENCE: ReservationLifecycleState[] = [
  "draft",
  "verification_required",
  "pending_approval",
  "approved",
  "released",
];

export default function ReservationBoard() {
  const events = useMemo(
    () => dedupeOperationalEventsById(buildGovernanceOperationalFeed({ escalationTopics: [] })),
    [],
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 pb-24">
      <header className="flex flex-wrap items-center gap-2 border-b border-border pb-4">
        <ListOrdered className="h-7 w-7 text-primary" aria-hidden />
        <h1 className="text-xl font-bold tracking-tight">Reservation board</h1>
        <Badge variant="outline" className="text-[10px] uppercase">
          Governance-first
        </Badge>
      </header>
      <p className="text-sm text-muted-foreground">
        Create governed <strong>inventory_reservations</strong> for dispatched orders, then complete physical
        consumption on{" "}
        <a href="/admin/stock-finalization" className="underline">
          Stock finalization
        </a>
        . All reservation writes use the Phase 4A service — no direct table inserts from this UI.
      </p>

      <ReservationGovernancePanel />

      <details className="rounded-md border border-border/50 p-3">
        <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
          Lifecycle design reference (non-persisted)
        </summary>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {STATE_REFERENCE.map((s) => (
            <Card key={s} className="shadow-none ring-1 ring-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold capitalize">{s.replace(/_/g, " ")}</CardTitle>
                <Badge
                  variant={reservationRequiresLocking(s) ? "destructive" : "secondary"}
                  className="w-fit text-[10px] uppercase"
                >
                  {reservationRequiresLocking(s) ? "Would require lock" : "No lock claim"}
                </Badge>
              </CardHeader>
              <CardContent className="text-[11px] text-muted-foreground">
                Next: {(RESERVATION_VALID_NEXT[s] ?? []).join(", ") || "—"}
              </CardContent>
            </Card>
          ))}
        </div>
      </details>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Governance timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <OperationalTimeline
            events={events}
            showFilters={false}
            defaultFilter="all"
            ariaLabel="Reservation governance timeline"
          />
        </CardContent>
      </Card>
    </div>
  );
}
