import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Building2,
  Factory,
  Heart,
  Loader2,
  RefreshCw,
  Store,
  Truck,
  Warehouse,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PageStatus = "loading" | "empty";

const INTEGRATION_MSG = "Retail integration pending — read-only projections will appear here once connected.";

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

function SectionPlaceholder({
  title,
  description,
  icon: Icon,
  status,
}: {
  title: string;
  description: string;
  icon: React.ElementType;
  status: PageStatus;
}) {
  return (
    <Card className="overflow-hidden rounded-md border-border/80 shadow-none ring-1 ring-border/40">
      <CardHeader className="space-y-1 border-b border-border/60 bg-muted/20 px-4 py-3 sm:px-5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            <CardTitle className="text-sm font-semibold tracking-tight sm:text-base">{title}</CardTitle>
          </div>
          <Badge variant="outline" className="shrink-0 text-[10px] font-medium uppercase">
            Read-only
          </Badge>
        </div>
        <CardDescription className="text-[11px] leading-snug sm:text-xs">{description}</CardDescription>
      </CardHeader>
      <CardContent className="px-4 py-6 sm:px-5">
        {status === "loading" && (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-muted-foreground" role="status">
            <Loader2 className="h-7 w-7 animate-spin text-primary" aria-hidden />
            <p className="text-xs font-medium">Loading snapshot…</p>
          </div>
        )}
        {status === "empty" && (
          <div className="rounded-md border border-dashed border-border bg-muted/10 px-3 py-8 text-center" role="status">
            <p className="text-sm font-medium text-foreground">{INTEGRATION_MSG}</p>
            <p className="mt-2 text-[11px] text-muted-foreground">
              No inventory mutations, no auto-reallocation — operator-driven execution only.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Phase B1 — Store coordination operational shell (read-only, no writes).
 * Sections are placeholders until retail projections are wired.
 */
export default function StoreCoordination() {
  const [pageStatus, setPageStatus] = useState<PageStatus>("loading");
  const refreshTimerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const id = window.setTimeout(() => setPageStatus("empty"), 380);
    return () => window.clearTimeout(id);
  }, []);

  const refresh = useCallback(() => {
    if (refreshTimerRef.current !== undefined) window.clearTimeout(refreshTimerRef.current);
    setPageStatus("loading");
    refreshTimerRef.current = window.setTimeout(() => {
      setPageStatus("empty");
      refreshTimerRef.current = undefined;
    }, 380);
  }, []);

  useEffect(
    () => () => {
      if (refreshTimerRef.current !== undefined) window.clearTimeout(refreshTimerRef.current);
    },
    [],
  );

  const sections = useMemo(
    () => [
      {
        key: "snapshot",
        title: "Live Store Snapshot",
        description: "Per-store pulse: reservations, confidence, shortages, pickups, dispatch expectations.",
        icon: Store,
      },
      {
        key: "reservations",
        title: "Reservation Queue",
        description: "Prebooking visibility — linked orders, pickup windows, priority and wedding tags.",
        icon: Warehouse,
      },
      {
        key: "factory",
        title: "Factory Follow-up Queue",
        description: "Store ↔ factory handoff — departments, urgency, dispatch hints, WhatsApp linkage readouts.",
        icon: Factory,
      },
      {
        key: "interstore",
        title: "Inter-store Coordination",
        description: "Cross-store transfers and escalation visibility (read-only).",
        icon: Building2,
      },
      {
        key: "alerts",
        title: "Retail Alerts",
        description: "Operational signals: shortages, delayed pickups, customer wait — no auto-actions.",
        icon: AlertTriangle,
      },
      {
        key: "wedding",
        title: "Wedding / Bulk Preparation Queue",
        description: "High-touch fulfilment lane — wedding tags, bulk prep, pickup readiness.",
        icon: Heart,
      },
    ],
    [],
  );

  return (
    <div className="relative mx-auto max-w-6xl pb-24">
      <header className="mb-6 space-y-3 border-b border-border/80 pb-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Retail operations</p>
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">Store coordination</h1>
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Mobile-first visibility across stores, reservations, and factory follow-up. Human-controlled; no stock
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

      <div className="grid gap-4 sm:grid-cols-2">
        {sections.map((s) => (
          <SectionPlaceholder key={s.key} title={s.title} description={s.description} icon={s.icon} status={pageStatus} />
        ))}
      </div>

      <div
        className={cn(
          "sticky bottom-0 z-20 mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-border/80 bg-background/95 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:gap-3",
        )}
      >
        <Button type="button" variant="default" className="min-h-9 min-w-[44px] touch-manipulation" onClick={refresh}>
          <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
          Refresh view
        </Button>
        <Badge variant="secondary" className="min-h-9 rounded-md px-3 py-1.5 text-[11px] font-medium">
          <Truck className="mr-1.5 inline h-3.5 w-3.5" aria-hidden />
          Dispatch neutral
        </Badge>
      </div>
    </div>
  );
}
