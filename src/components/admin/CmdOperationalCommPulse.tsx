import { Link } from "react-router-dom";
import { IndianRupee, MessageCircle, Truck } from "lucide-react";

export interface CmdOperationalCommPulseProps {
  openWhatsappPackets: number;
  staleWhatsappPackets: number;
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
  return (
    <section
      className="rounded-lg border border-border bg-gradient-to-br from-card to-muted/30 p-3 shadow-sm"
      aria-labelledby="cmd-comm-pulse-heading"
    >
      <h2 id="cmd-comm-pulse-heading" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Operational communication pulse
      </h2>
      <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
        Read-only visibility. WhatsApp counts use open packets + idle buckets; order counts use the same War Room order
        list.
      </p>
      {loadError ? (
        <p className="mt-2 text-[11px] text-destructive" role="status">
          WhatsApp pulse partial: {loadError}
        </p>
      ) : null}
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-md border border-border bg-background/80 px-2 py-2">
          <div className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            <MessageCircle className="h-3.5 w-3.5" aria-hidden />
            WA open
          </div>
          <p className="mt-1 font-mono text-lg font-semibold tabular-nums">{openWhatsappPackets}</p>
        </div>
        <div className="rounded-md border border-border bg-background/80 px-2 py-2">
          <div className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            <MessageCircle className="h-3.5 w-3.5 text-amber-600" aria-hidden />
            WA stale
          </div>
          <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-amber-800">{staleWhatsappPackets}</p>
        </div>
        <div className="rounded-md border border-border bg-background/80 px-2 py-2">
          <div className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            <IndianRupee className="h-3.5 w-3.5" aria-hidden />
            Finance wait
          </div>
          <p className="mt-1 font-mono text-lg font-semibold tabular-nums">{financePressureOrders}</p>
        </div>
        <div className="rounded-md border border-border bg-background/80 px-2 py-2">
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
