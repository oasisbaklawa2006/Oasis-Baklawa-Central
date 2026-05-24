import { Link } from "react-router-dom";
import { IndianRupee, MessageCircle, Truck } from "lucide-react";

export interface CmdOperationalCommPulseProps {
  /** Null until a successful fetch, or after a failed fetch (never coerce failure to 0). */
  openWhatsappPackets: number | null;
  staleWhatsappPackets: number | null;
  financePressureOrders: number;
  dispatchPanicOrders: number;
  loadError?: string | null;
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
}: CmdOperationalCommPulseProps) {
  const fmtWa = (n: number | null) =>
    n === null ? <span className="text-muted-foreground">—</span> : n;

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
