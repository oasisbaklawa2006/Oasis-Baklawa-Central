import { Link } from "react-router-dom";
import { IndianRupee, MessageCircle, Store, Tag, Truck, Warehouse, ScanLine, AlertTriangle, ListOrdered, Network, Gauge } from "lucide-react";
import type { WorkQueueId } from "@/lib/work-queues/queueTypes";
import { WORK_QUEUE_LABELS } from "@/lib/work-queues/queueTypes";

export interface CmdOperationalCommPulseProps {
  /** Null until a successful fetch, or after a failed fetch (never coerce failure to 0). */
  openWhatsappPackets: number | null;
  staleWhatsappPackets: number | null;
  financePressureOrders: number;
  dispatchPanicOrders: number;
  loadError?: string | null;
  /** Read-only `factory_inventory` row count (exact count query); null when pending or failed. */
  factoryInventoryRowCount?: number | null;
  factoryInventoryError?: string | null;
  /**
   * Aggregate execution dependency projection. Finance lane follows War Room finance-wait count;
   * other lanes are treated as satisfied in this strip until dedicated readiness feeds are wired — avoids fake blockers.
   */
  executionBlockedLanes?: number;
  executionPendingLanes?: number;
  executionBottleneckLane?: string | null;
  /** Human-readable root cause (e.g. finance blocking downstream). */
  executionBottleneckContext?: string | null;
  /** First blocked lane when it differs from root cause (downstream context). */
  executionVisibleBlockedLane?: string | null;
  /** Count of derived escalation strings from the same lane evaluation (not a persisted ticket count). */
  executionEscalationTopics?: number;
  /** Rows from inventory OS variance derivation (projection); shelf truth flagged unknown until outlet feed lands. */
  inventoryRiskAttentionRows?: number;
  /** War Room triage-style count (same window as review heuristic below). */
  manualVerificationLoad?: number;
  /** Orders on finance hold in the War Room bounded list — governance / finance pressure proxy. */
  governanceHoldOrders?: number;
  /** Null until a bounded scan window is connected; never invent scan rows. */
  scanAnomalyCount?: number | null;
  /** Null until reservation signal feed is connected. */
  reservationRiskSignals?: number | null;
  /** Unified dependency graph root blocker label (projection). */
  unifiedRootBlocker?: string | null;
  unifiedBlockerContext?: string | null;
  /** Finance blocking downstream dispatch chain (projection). */
  financeToDispatchDependencyRisk?: boolean;
  /** Sum of customer-impact queue pressures when connected; null otherwise. */
  customerRiskQueuePressure?: number | null;
  /** Hottest queue by explicit pressure input; null when no queue connected. */
  escalationHotspotQueue?: WorkQueueId | null;
  reservationVerificationLoad?: number | null;
  scanExceptionPressure?: number | null;
  feedFreshnessWarnings?: string[];
  feedFreshness?: "live" | "partial" | "unavailable";
}

/**
 * CMD visibility strip — counts only; no automation or writes.
 */
export function CmdOperationalCommPulse({
  openWhatsappPackets,
  staleWhatsappPackets,
  financePressureOrders,
  dispatchPanicOrders,
  loadError,
  factoryInventoryRowCount = null,
  factoryInventoryError = null,
  executionBlockedLanes = 0,
  executionPendingLanes = 0,
  executionBottleneckLane = null,
  executionBottleneckContext = null,
  executionVisibleBlockedLane = null,
  executionEscalationTopics = 0,
  inventoryRiskAttentionRows = 0,
  manualVerificationLoad = 0,
  governanceHoldOrders = 0,
  scanAnomalyCount = null,
  reservationRiskSignals = null,
  unifiedRootBlocker = null,
  unifiedBlockerContext = null,
  financeToDispatchDependencyRisk = false,
  customerRiskQueuePressure = null,
  escalationHotspotQueue = null,
  reservationVerificationLoad = null,
  scanExceptionPressure = null,
  feedFreshnessWarnings = [],
  feedFreshness = "live",
}: CmdOperationalCommPulseProps) {
  const fmtWa = (n: number | null) =>
    n === null ? <span className="text-muted-foreground">—</span> : n;
  const fmtPending = (n: number | null) =>
    n === null ? <span className="text-muted-foreground">pending</span> : n;

  return (
    <section
      className="rounded-lg border border-border bg-gradient-to-br from-card to-muted/30 p-3 shadow-sm"
      aria-labelledby="cmd-comm-pulse-heading"
    >
      <h2 id="cmd-comm-pulse-heading" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Operational communication pulse
      </h2>
      <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
        Read-only visibility. WhatsApp open/stale are counted on the <span className="font-medium text-foreground/80">latest 1000</span> open
        packets, ordered like the operator inbox (bounded sample — not a global total if more rows exist). Finance wait
        and dispatch panic use the same War Room order window as the list below.
      </p>
      {loadError ? (
        <p className="mt-2 text-[11px] text-destructive" role="status">
          WhatsApp pulse unavailable: {loadError}
        </p>
      ) : null}
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div
          className="rounded-md border border-border bg-background/80 px-2 py-2"
          title="Open packets in the latest 1000-row inbox-ordered window. If more than 1000 open packets exist globally, this is a lower bound."
        >
          <div className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            <MessageCircle className="h-3.5 w-3.5" aria-hidden />
            WA open (latest 1000)
          </div>
          <p className="mt-1 font-mono text-lg font-semibold tabular-nums">{fmtWa(openWhatsappPackets)}</p>
        </div>
        <div
          className="rounded-md border border-border bg-background/80 px-2 py-2"
          title="Stale idle bucket count within the same latest-1000 open-packet window as WA open (inbox ordering)."
        >
          <div className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            <MessageCircle className="h-3.5 w-3.5 text-amber-600" aria-hidden />
            WA stale (same window)
          </div>
          <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-amber-800">{fmtWa(staleWhatsappPackets)}</p>
        </div>
        <div
          className="rounded-md border border-border bg-background/80 px-2 py-2"
          title="Orders in the War Room active list (~200 newest non-terminal rows) where finance_hold is true — not a full-ledger total."
        >
          <div className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            <IndianRupee className="h-3.5 w-3.5" aria-hidden />
            Finance wait
          </div>
          <p className="mt-1 font-mono text-lg font-semibold tabular-nums">{financePressureOrders}</p>
        </div>
        <div
          className="rounded-md border border-border bg-background/80 px-2 py-2"
          title="Orders in the War Room active list with dispatch_urgency = panic — same bounded window as finance wait."
        >
          <div className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            <Truck className="h-3.5 w-3.5 text-orange-600" aria-hidden />
            Dispatch panic
          </div>
          <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-orange-800">{dispatchPanicOrders}</p>
        </div>
      </div>
      <div
        className="mt-3 rounded-md border border-border/80 bg-background/50 px-2 py-2"
        title="Execution dependency graph evaluated with finance lane driven by War Room finance-wait count; other lanes neutral (satisfied) until dedicated readiness signals exist — avoids silent fake bottlenecks."
      >
        <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          <AlertTriangle className="h-3.5 w-3.5 text-rose-700 dark:text-rose-300" aria-hidden />
          Execution & inventory risk (projection)
        </div>
        <p className="mt-1 text-[10px] leading-snug text-muted-foreground">
          Read-only lane math plus inventory OS variance hints. Not a persisted escalation queue. Bottleneck shows{" "}
          <span className="font-medium text-foreground/90">root cause</span> (e.g. finance when it blocks downstream lanes), not only the first blocked row.
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-md border border-border bg-background/80 px-2 py-2">
            <div className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">Blocked lanes</div>
            <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-rose-800 dark:text-rose-100">{executionBlockedLanes}</p>
          </div>
          <div className="rounded-md border border-border bg-background/80 px-2 py-2">
            <div className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">Pending lanes</div>
            <p className="mt-1 font-mono text-lg font-semibold tabular-nums">{executionPendingLanes}</p>
          </div>
          <div className="rounded-md border border-border bg-background/80 px-2 py-2">
            <div className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">Escalation topics</div>
            <p className="mt-1 font-mono text-lg font-semibold tabular-nums">{executionEscalationTopics}</p>
          </div>
          <div className="rounded-md border border-border bg-background/80 px-2 py-2 col-span-2 sm:col-span-4">
            <div className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">Bottleneck (root cause)</div>
            <p className="mt-1 text-[11px] font-medium leading-snug break-all">{executionBottleneckLane ?? "—"}</p>
            {executionBottleneckContext ? (
              <p className="mt-1 text-[10px] leading-snug text-muted-foreground">{executionBottleneckContext}</p>
            ) : null}
            {executionVisibleBlockedLane && executionVisibleBlockedLane !== executionBottleneckLane ? (
              <p className="mt-1 text-[9px] text-muted-foreground">
                Downstream blocked context: <span className="font-mono text-foreground/90">{executionVisibleBlockedLane}</span>
              </p>
            ) : null}
          </div>
          <div className="rounded-md border border-border bg-background/80 px-2 py-2">
            <div className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">Inventory risk rows</div>
            <p className="mt-1 font-mono text-lg font-semibold tabular-nums">{inventoryRiskAttentionRows}</p>
          </div>
          <div className="rounded-md border border-border bg-background/80 px-2 py-2">
            <div className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">Governance holds</div>
            <p className="mt-1 font-mono text-lg font-semibold tabular-nums">{governanceHoldOrders}</p>
            <p className="mt-0.5 text-[9px] text-muted-foreground">Finance-wait orders (same window)</p>
          </div>
          <div className="rounded-md border border-border bg-background/80 px-2 py-2">
            <div className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">Manual verification load</div>
            <p className="mt-1 font-mono text-lg font-semibold tabular-nums">{manualVerificationLoad}</p>
            <p className="mt-0.5 text-[9px] text-muted-foreground">Triage-style review count</p>
          </div>
          <div className="rounded-md border border-border bg-background/80 px-2 py-2">
            <div className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">Scan anomalies</div>
            <p className="mt-1 font-mono text-lg font-semibold tabular-nums">{fmtPending(scanAnomalyCount)}</p>
          </div>
          <div className="rounded-md border border-border bg-background/80 px-2 py-2 sm:col-span-2">
            <div className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">Reservation risk signals</div>
            <p className="mt-1 font-mono text-lg font-semibold tabular-nums">{fmtPending(reservationRiskSignals)}</p>
            <p className="mt-0.5 text-[9px] text-muted-foreground">Awaiting persisted reservation read model</p>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <Link
            to="/admin/inventory-command-center"
            className="inline-flex min-h-9 items-center rounded-md border border-border px-3 text-xs font-medium text-foreground outline-none transition hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Inventory command center
          </Link>
          <Link
            to="/admin/inventory-risk-board"
            className="inline-flex min-h-9 items-center rounded-md border border-border px-3 text-xs font-medium text-foreground outline-none transition hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Risk & variance board
          </Link>
          <Link
            to="/admin/scan-timeline"
            className="inline-flex min-h-9 items-center rounded-md border border-border px-3 text-xs font-medium text-foreground outline-none transition hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Scan timeline
          </Link>
        </div>
      </div>
      <div
        className="mt-3 rounded-md border border-border/80 bg-background/50 px-2 py-2"
        title="Live work queue foundation — projection from War Room signals where connected; pending otherwise."
      >
        <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          <ListOrdered className="h-3.5 w-3.5" aria-hidden />
          Queue pressure (projection)
        </div>
        <p className="mt-1 text-[10px] leading-snug text-muted-foreground">
          Unified blocker lane and queue hotspots via shared live-feed adapters. Feed freshness:{" "}
          <span className="font-medium text-foreground/90">{feedFreshness}</span>
        </p>
        {feedFreshnessWarnings.length > 0 ? (
          <ul className="mt-1 list-inside list-disc text-[10px] text-amber-800 dark:text-amber-200">
            {feedFreshnessWarnings.slice(0, 4).map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        ) : null}
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-md border border-border bg-background/80 px-2 py-2 col-span-2 sm:col-span-4">
            <div className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">Unified root blocker</div>
            <p className="mt-1 text-[11px] font-medium">{unifiedRootBlocker ?? "—"}</p>
            {unifiedBlockerContext ? (
              <p className="mt-1 text-[10px] text-muted-foreground">{unifiedBlockerContext}</p>
            ) : null}
          </div>
          <div className="rounded-md border border-border bg-background/80 px-2 py-2">
            <div className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">Finance→dispatch risk</div>
            <p className="mt-1 font-mono text-sm font-semibold">{financeToDispatchDependencyRisk ? "yes" : "no"}</p>
          </div>
          <div className="rounded-md border border-border bg-background/80 px-2 py-2">
            <div className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">Customer-risk queue</div>
            <p className="mt-1 font-mono text-lg font-semibold tabular-nums">{fmtPending(customerRiskQueuePressure)}</p>
          </div>
          <div className="rounded-md border border-border bg-background/80 px-2 py-2">
            <div className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">Escalation hotspot</div>
            <p className="mt-1 text-[10px] font-medium leading-snug">
              {escalationHotspotQueue ? WORK_QUEUE_LABELS[escalationHotspotQueue] : "—"}
            </p>
          </div>
          <div className="rounded-md border border-border bg-background/80 px-2 py-2">
            <div className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">Reservation verification</div>
            <p className="mt-1 font-mono text-lg font-semibold tabular-nums">{fmtPending(reservationVerificationLoad)}</p>
          </div>
          <div className="rounded-md border border-border bg-background/80 px-2 py-2">
            <div className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">Scan exception pressure</div>
            <p className="mt-1 font-mono text-lg font-semibold tabular-nums">{fmtPending(scanExceptionPressure)}</p>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <Link
            to="/admin/execution-command-center"
            className="inline-flex min-h-9 items-center rounded-md border border-primary/40 bg-primary/5 px-3 text-xs font-medium text-foreground outline-none transition hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <Gauge className="mr-1 inline h-3.5 w-3.5" aria-hidden />
            Execution CMD
          </Link>
          <Link
            to="/admin/live-work-queues"
            className="inline-flex min-h-9 items-center rounded-md border border-border px-3 text-xs font-medium text-foreground outline-none transition hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Live work queues
          </Link>
          <Link
            to="/admin/entity-graph-explorer"
            className="inline-flex min-h-9 items-center rounded-md border border-border px-3 text-xs font-medium text-foreground outline-none transition hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <Network className="mr-1 inline h-3.5 w-3.5" aria-hidden />
            Entity graph
          </Link>
        </div>
      </div>
      <div
        className="mt-3 rounded-md border border-border/80 bg-background/60 px-2 py-2"
        title="Head count on factory_inventory only. Not branch shelf stock; use Store coordination for outlet-level read-only grouping."
      >
        <div className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          <Warehouse className="h-3.5 w-3.5" aria-hidden />
          Inventory visibility (read-only)
        </div>
        {factoryInventoryError ? (
          <p className="mt-1 text-[11px] text-amber-800 dark:text-amber-100" role="status">
            factory_inventory pulse unavailable · {factoryInventoryError}
          </p>
        ) : (
          <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
            <span className="font-medium text-foreground">factory_inventory rows:</span>{" "}
            {factoryInventoryRowCount === null ? (
              <span className="text-muted-foreground">pending</span>
            ) : (
              <span className="font-mono text-foreground">{factoryInventoryRowCount}</span>
            )}
            {" · "}
            <span className="font-medium text-foreground">Branch shelf / ready goods source:</span> still pending —{" "}
            <span className="text-amber-900 dark:text-amber-100">manual verification</span> until barcode / outlet feed
            lands.
          </p>
        )}
        <div className="mt-2">
          <Link
            to="/admin/store-coordination"
            className="inline-flex min-h-9 items-center rounded-md border border-border px-3 text-xs font-medium text-foreground outline-none transition hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Store coordination · ready goods
          </Link>
        </div>
      </div>
      <div className="mt-3 rounded-md border border-border/80 bg-background/40 px-2 py-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Retail / label pilot (read-only)</p>
        <p className="mt-1 text-[10px] leading-snug text-muted-foreground">
          No live counts below — coordination backends are not fully connected. Use Store coordination for local drafts and label previews.
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {[
            { icon: Store, label: "Retail coordination", body: "Pending — not connected" },
            { icon: Tag, label: "Reservation backend", body: "Pending — not connected" },
            { icon: ScanLine, label: "Label system", body: "Pending — not connected" },
            { icon: AlertTriangle, label: "Manual stock verification", body: "Required until shelf feed" },
            { icon: Truck, label: "Pickup risk", body: "Monitor store coordination" },
          ].map(({ icon: Icon, label, body }) => (
            <div key={label} className="rounded-md border border-border/70 bg-background/70 px-2 py-1.5">
              <div className="flex items-center gap-1 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
                <Icon className="h-3 w-3 shrink-0" aria-hidden />
                {label}
              </div>
              <p className="mt-1 text-[10px] leading-snug text-foreground/90">{body}</p>
            </div>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <Link
            to="/admin/label-command-center"
            className="inline-flex min-h-9 items-center rounded-md border border-border px-3 text-xs font-medium text-foreground outline-none transition hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Label command center
          </Link>
          <Link
            to="/admin/customer-timeline-preview"
            className="inline-flex min-h-9 items-center rounded-md border border-border px-3 text-xs font-medium text-foreground outline-none transition hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Customer timeline preview
          </Link>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          to="/admin/operator-inbox"
          className="inline-flex min-h-9 items-center rounded-md border border-primary/40 bg-primary/5 px-3 text-xs font-medium text-primary outline-none transition hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Open WhatsApp inbox
        </Link>
        <Link
          to="/admin/central-pool"
          className="inline-flex min-h-9 items-center rounded-md border border-border px-3 text-xs font-medium text-foreground outline-none transition hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Orders / trace
        </Link>
      </div>
    </section>
  );
}
