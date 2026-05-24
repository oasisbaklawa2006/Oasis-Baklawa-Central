import { useMemo } from "react";
import { ListOrdered } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ReservationLifecycleState } from "@/lib/inventory-operating-system/inventoryTypes";
import { RESERVATION_VALID_NEXT, reservationRequiresLocking } from "@/lib/inventory-operating-system/reservationLifecycle";
import { OperationalTimeline } from "@/components/admin/OperationalTimeline";
import { dedupeOperationalEventsById } from "@/lib/operational-events/normalize";
import { buildGovernanceOperationalFeed } from "@/lib/operational-events/governanceOperationalFeed";

const DEMO: ReservationLifecycleState[] = ["draft", "verification_required", "pending_approval", "approved", "released"];

export default function ReservationBoard() {
  const events = useMemo(
    () => dedupeOperationalEventsById(buildGovernanceOperationalFeed({ escalationTopics: ["Reservation approvals"] })),
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
        States below are design references only — no persisted reservation locks. Locking requires persistence + RLS in a future PR.
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        {DEMO.map((s) => (
          <Card key={s} className="shadow-none ring-1 ring-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold capitalize">{s.replace(/_/g, " ")}</CardTitle>
              <Badge variant={reservationRequiresLocking(s) ? "destructive" : "secondary"} className="w-fit text-[10px] uppercase">
                {reservationRequiresLocking(s) ? "Would require lock" : "No lock claim"}
              </Badge>
            </CardHeader>
            <CardContent className="text-[11px] text-muted-foreground">
              Next: {(RESERVATION_VALID_NEXT[s] ?? []).join(", ") || "—"}
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Governance timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <OperationalTimeline events={events} showFilters={false} defaultFilter="all" ariaLabel="Reservation governance timeline" />
        </CardContent>
      </Card>
    </div>
  );
}
