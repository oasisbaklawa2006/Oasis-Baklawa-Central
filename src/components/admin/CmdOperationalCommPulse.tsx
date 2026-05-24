import { Link } from "react-router-dom";
import {
  IndianRupee,
  MessageCircle,
  Store,
  Tag,
  Truck,
  Warehouse,
  ScanLine,
  AlertTriangle,
  BellRing,
  FolderOpen,
  FileWarning,
} from "lucide-react";

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
   * Count of urgent/critical rows in the visibility-only notification projection feed
   * (bounded War Room / inbox signals — not an outbox unread count).
   */
  notificationUrgentProjectionCount?: number | null;
  /** Shell catalog count of document classes requiring manual attachment verification (metadata only). */
  mediaManualVerifyProjectionCount?: number | null;
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
  notificationUrgentProjectionCount = null,
  mediaManualVerifyProjectionCount = null,
}: CmdOperationalCommPulseProps) {
  const fmtWa = (n: number | null) =>
    n === null ? <span className="text-muted-foreground">—</span> : n;

  const fmtProjection = (n: number | null) =>
    n === null ? <span className="text-muted-foreground">pending</span> : <span className="font-mono text-foreground">{n}</span>;

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
      <div className="mt-3 rounded-md border border-violet-500/30 bg-violet-500/5 px-2 py-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Notification & media visibility</p>
        <p className="mt-1 text-[10px] leading-snug text-muted-foreground">
          No send engine and no upload backend — counts below are projection summaries or shell-catalog hints, not delivery or storage totals.
        </p>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="rounded-md border border-border/70 bg-background/70 px-2 py-1.5">
            <div className="flex items-center gap-1 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
              <BellRing className="h-3 w-3 shrink-0" aria-hidden />
              Notification center · visibility only
            </div>
            <p className="mt-1 text-[10px] leading-snug text-foreground/90">
              High-severity projection rows (urgent/critical topics in the feed): {fmtProjection(notificationUrgentProjectionCount)}
            </p>
          </div>
          <div className="rounded-md border border-border/70 bg-background/70 px-2 py-1.5">
            <div className="flex items-center gap-1 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
              <FolderOpen className="h-3 w-3 shrink-0" aria-hidden />
              Media vault · metadata only
            </div>
            <p className="mt-1 text-[10px] leading-snug text-foreground/90">
              Document classes flagged for manual attachment verification (catalog): {fmtProjection(mediaManualVerifyProjectionCount)}
            </p>
          </div>
          <div className="rounded-md border border-border/70 bg-background/70 px-2 py-1.5 sm:col-span-2">
            <div className="flex items-center gap-1 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
              <FileWarning className="h-3 w-3 shrink-0" aria-hidden />
              Open attention (existing War Room windows)
            </div>
            <p className="mt-1 text-[10px] leading-snug text-foreground/90">
              Continue using finance wait, dispatch panic, and WhatsApp stale tiles above — notification center does not duplicate outbound sends.
            </p>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <Link
            to="/admin/notification-center"
            className="inline-flex min-h-9 items-center rounded-md border border-violet-500/40 bg-violet-500/10 px-3 text-xs font-medium text-foreground outline-none transition hover:bg-violet-500/15 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Notification Center
          </Link>
          <Link
            to="/admin/media-vault"
            className="inline-flex min-h-9 items-center rounded-md border border-violet-500/40 bg-violet-500/10 px-3 text-xs font-medium text-foreground outline-none transition hover:bg-violet-500/15 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Media vault
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
          to="/admin/orders"
          className="inline-flex min-h-9 items-center rounded-md border border-border px-3 text-xs font-medium text-foreground outline-none transition hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Orders / trace
        </Link>
      </div>
    </section>
  );
}
