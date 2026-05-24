import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Building2,
  Heart,
  RefreshCw,
  Truck,
  Warehouse,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { OperationalTimeline, type OperationalTimelineFilter } from "@/components/admin/OperationalTimeline";
import {
  buildStoreCoordinationOperationalFeed,
  DEFAULT_RETAIL_OUTLETS,
  normalizeStoreCoordinationEvents,
} from "@/lib/operational-events/storeFeed";

function StatusChip({ tone, children }: { tone: "info" | "warning" | "urgent" | "critical"; children: React.ReactNode }) {
  const map = {
    info: "border-sky-500/40 bg-sky-500/10 text-sky-900 dark:text-sky-100",
    warning: "border-amber-500/40 bg-amber-500/10 text-amber-950 dark:text-amber-100",
    urgent: "border-orange-500/50 bg-orange-500/10 text-orange-950 dark:text-orange-100",
    critical: "border-destructive/50 bg-destructive/10 text-destructive",
  } as const;
  return (
    <span className={cn("inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", map[tone])}>
      {children}
    </span>
  );
}

const INTEGRATION_MSG = "Retail integration pending — read-only projections will appear here once connected.";

const RESERVATION_QUEUE_DISPLAY = [
  {
    customer: "—",
    store: "Outlet (TBD)",
    product: "—",
    qty: "—",
    pickupDate: "—",
    status: "Backend pending",
    notes: "Local capture not enabled yet",
  },
];

const FACTORY_FOLLOWUP_DISPLAY = [
  {
    store: "Outlet (TBD)",
    product: "—",
    neededBy: "—",
    urgency: "Unknown",
    department: "—",
    status: "Integration pending",
    lastFollowup: "—",
  },
];

/**
 * Store coordination — B1 shell + B2 visibility cards + B5 operational projections (read-only, no writes).
 */
export default function StoreCoordination() {
  const [tick, setTick] = useState(0);
  const refreshTimerRef = useRef<number | undefined>(undefined);
  const [timelineFilter, setTimelineFilter] = useState<OperationalTimelineFilter>("all");

  useEffect(
    () => () => {
      if (refreshTimerRef.current !== undefined) window.clearTimeout(refreshTimerRef.current);
    },
    [],
  );

  const timelineEvents = useMemo(() => {
    void tick;
    return normalizeStoreCoordinationEvents(
      buildStoreCoordinationOperationalFeed({
        outlets: DEFAULT_RETAIL_OUTLETS,
        reservations: [],
        followups: [],
        nowMs: 0,
      }),
    );
  }, [tick]);

  const refresh = useCallback(() => {
    if (refreshTimerRef.current !== undefined) window.clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = window.setTimeout(() => {
      setTick((t) => t + 1);
      refreshTimerRef.current = undefined;
    }, 200);
  }, []);

  return (
    <div className="relative mx-auto max-w-6xl space-y-8 pb-28">
      <header className="space-y-3 border-b border-border/80 pb-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Retail operations</p>
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">Store coordination</h1>
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Mobile-first visibility across outlets, reservations, and factory follow-up. Human-controlled; no stock
              mutations from this surface.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <StatusChip tone="info">Visibility</StatusChip>
            <StatusChip tone="warning">Operator</StatusChip>
            <StatusChip tone="critical">No writes</StatusChip>
          </div>
        </div>
      </header>

      {/* B2 — Stock visibility */}
      <section className="space-y-3" aria-labelledby="store-stock-heading">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 id="store-stock-heading" className="text-sm font-bold uppercase tracking-wide text-foreground">
            Live store snapshot · stock visibility
          </h2>
          <Badge variant="outline" className="text-[10px] uppercase">
            No live quantities
          </Badge>
        </div>
        <p className="text-[11px] leading-snug text-muted-foreground">
          Live stock integration pending · ready goods source pending · store inventory feed pending. Every outlet below
          shows <span className="font-medium text-amber-900 dark:text-amber-100">unknown / manual verification</span>{" "}
          until feeds connect.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {DEFAULT_RETAIL_OUTLETS.map((o) => (
            <Card
              key={o.id}
              className="overflow-hidden rounded-md border-amber-500/25 bg-gradient-to-br from-card to-amber-500/5 shadow-none ring-1 ring-border/50"
            >
              <CardHeader className="space-y-1 border-b border-border/60 px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-sm font-semibold leading-tight">{o.name}</CardTitle>
                  <StatusChip tone="warning">Unknown</StatusChip>
                </div>
                <CardDescription className="text-[11px]">Outlet ID · {o.id}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 px-4 py-3 text-[11px] leading-snug text-muted-foreground">
                <p>
                  <span className="font-medium text-foreground">Stock confidence:</span> Pending integration — manual
                  verification required.
                </p>
                <p>
                  <span className="font-medium text-foreground">Operational risk:</span> Customer may see packing as
                  unavailable; reservations cannot be guaranteed from this screen.
                </p>
                <p className="rounded border border-border/80 bg-muted/30 px-2 py-1.5 text-foreground">
                  <span className="font-medium">Safe action:</span> Verify with store / factory directly; use factory
                  follow-up queue once backend is connected.
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* B2 — Reservation shell */}
      <section className="space-y-3" aria-labelledby="res-queue-heading">
        <h2 id="res-queue-heading" className="text-sm font-bold uppercase tracking-wide text-foreground">
          Reservation / prebooking queue
        </h2>
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-[11px] leading-snug text-destructive" role="alert">
          <strong className="font-semibold">Reservation capture is not active yet.</strong> Do not promise held stock
          from this screen. No stock deduction is performed here.
        </div>
        <div className="hidden overflow-x-auto rounded-md border border-border md:block">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead className="border-b border-border bg-muted/40 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Customer</th>
                <th className="px-3 py-2">Store</th>
                <th className="px-3 py-2">Product / packing</th>
                <th className="px-3 py-2">Qty</th>
                <th className="px-3 py-2">Pickup date</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Notes</th>
              </tr>
            </thead>
            <tbody>
              {RESERVATION_QUEUE_DISPLAY.map((r, i) => (
                <tr key={i} className="border-b border-border/70 last:border-0">
                  <td className="px-3 py-2 font-mono text-foreground">{r.customer}</td>
                  <td className="px-3 py-2">{r.store}</td>
                  <td className="px-3 py-2">{r.product}</td>
                  <td className="px-3 py-2 font-mono">{r.qty}</td>
                  <td className="px-3 py-2 font-mono">{r.pickupDate}</td>
                  <td className="px-3 py-2">
                    <Badge variant="secondary" className="text-[10px]">
                      {r.status}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{r.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="space-y-2 md:hidden">
          {RESERVATION_QUEUE_DISPLAY.map((r, i) => (
            <Card key={i} className="rounded-md border-border/80 shadow-none">
              <CardContent className="space-y-1.5 p-3 text-xs">
                <p className="font-semibold text-foreground">{r.store}</p>
                <p className="text-muted-foreground">
                  Customer · {r.customer} · Pickup · {r.pickupDate}
                </p>
                <p className="text-muted-foreground">
                  {r.product} · Qty {r.qty}
                </p>
                <Badge variant="secondary" className="text-[10px]">
                  {r.status}
                </Badge>
                <p className="text-[11px] text-muted-foreground">{r.notes}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* B2 — Factory follow-up shell */}
      <section className="space-y-3" aria-labelledby="factory-queue-heading">
        <h2 id="factory-queue-heading" className="text-sm font-bold uppercase tracking-wide text-foreground">
          Factory follow-up queue
        </h2>
        <p className="text-[11px] text-muted-foreground">
          Integration pending — use phone, WhatsApp, or manual confirmation with production until rows sync here.
        </p>
        <div className="hidden overflow-x-auto rounded-md border border-border md:block">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead className="border-b border-border bg-muted/40 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Store</th>
                <th className="px-3 py-2">Product</th>
                <th className="px-3 py-2">Needed by</th>
                <th className="px-3 py-2">Urgency</th>
                <th className="px-3 py-2">Factory department</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Last follow-up</th>
              </tr>
            </thead>
            <tbody>
              {FACTORY_FOLLOWUP_DISPLAY.map((r, i) => (
                <tr key={i} className="border-b border-border/70 last:border-0">
                  <td className="px-3 py-2">{r.store}</td>
                  <td className="px-3 py-2">{r.product}</td>
                  <td className="px-3 py-2 font-mono">{r.neededBy}</td>
                  <td className="px-3 py-2">{r.urgency}</td>
                  <td className="px-3 py-2">{r.department}</td>
                  <td className="px-3 py-2">
                    <Badge variant="outline" className="text-[10px]">
                      {r.status}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 font-mono text-muted-foreground">{r.lastFollowup}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="space-y-2 md:hidden">
          {FACTORY_FOLLOWUP_DISPLAY.map((r, i) => (
            <Card key={i} className="rounded-md border-border/80 shadow-none">
              <CardContent className="space-y-1 p-3 text-xs">
                <p className="font-semibold text-foreground">{r.store}</p>
                <p className="text-muted-foreground">{r.product}</p>
                <p className="text-muted-foreground">
                  Needed by {r.neededBy} · {r.department} · {r.urgency}
                </p>
                <Badge variant="outline" className="text-[10px]">
                  {r.status}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Remaining roadmap slots */}
      <section className="grid gap-3 sm:grid-cols-3" aria-label="Additional coordination lanes">
        {[
          { title: "Inter-store coordination", icon: Building2 },
          { title: "Retail alerts", icon: AlertTriangle },
          { title: "Wedding / bulk preparation", icon: Heart },
        ].map(({ title, icon: Icon }) => (
          <Card key={title} className="rounded-md border-border/80 shadow-none ring-1 ring-border/40">
            <CardHeader className="flex flex-row items-center gap-2 space-y-0 border-b border-border/60 px-4 py-3">
              <Icon className="h-4 w-4 text-primary" aria-hidden />
              <CardTitle className="text-sm font-semibold">{title}</CardTitle>
            </CardHeader>
            <CardContent className="px-4 py-4">
              <p className="text-center text-[11px] leading-relaxed text-muted-foreground">{INTEGRATION_MSG}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      {/* B5 + B7 — Timeline */}
      <section className="space-y-2" aria-labelledby="store-timeline-heading">
        <h2 id="store-timeline-heading" className="text-sm font-bold uppercase tracking-wide text-foreground">
          Store coordination timeline
        </h2>
        <p className="text-[11px] leading-snug text-muted-foreground">
          These are <span className="font-medium text-foreground">readiness / projection events</span>, not live stock
          movements. occurredAt is intentionally empty for placeholder snapshots.
        </p>
        <OperationalTimeline
          events={timelineEvents}
          filter={timelineFilter}
          onFilterChange={setTimelineFilter}
          ariaLabel="Store coordination operational timeline"
        />
      </section>

      <div
        className={cn(
          "fixed bottom-0 left-0 right-0 z-30 border-t border-border/80 bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/85 lg:left-64",
        )}
      >
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2">
          <Button type="button" variant="default" className="min-h-9 min-w-[44px] touch-manipulation" onClick={refresh}>
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
            Refresh view
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="min-h-9 rounded-md px-3 py-1.5 text-[11px] font-medium">
              <Warehouse className="mr-1.5 inline h-3.5 w-3.5" aria-hidden />
              Reservations offline
            </Badge>
            <Badge variant="secondary" className="min-h-9 rounded-md px-3 py-1.5 text-[11px] font-medium">
              <Truck className="mr-1.5 inline h-3.5 w-3.5" aria-hidden />
              Dispatch neutral
            </Badge>
          </div>
        </div>
      </div>
    </div>
  );
}
