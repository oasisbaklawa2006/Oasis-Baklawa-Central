import { AlertTriangle, RefreshCw, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  useOperatorInboxAccountability,
  type OperatorInboxAccountabilityItem,
} from "@/components/whatsapp/useOperatorInboxAccountability";

function formatAge(iso: string): string {
  const ageMs = Math.max(0, Date.now() - Date.parse(iso));
  const hours = Math.floor(ageMs / 3_600_000);
  if (hours < 1) return "<1h";
  if (hours < 48) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function itemLabel(item: OperatorInboxAccountabilityItem): string {
  return item.provider_message_id || item.source_message_id;
}

export function OperatorInboxAccountabilityPanel({ refreshKey }: { refreshKey: number }) {
  const { items, summary, loading, error, reload } = useOperatorInboxAccountability(refreshKey);

  return (
    <section
      className="border-b border-amber-200 bg-amber-50/90 px-3 py-2"
      aria-labelledby="operator-inbox-accountability-heading"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <ShieldAlert className="h-4 w-4 shrink-0 text-amber-800" aria-hidden />
          <div className="min-w-0">
            <h2 id="operator-inbox-accountability-heading" className="text-sm font-semibold text-amber-950">
              Authorized-channel accountability
            </h2>
            <p className="text-xs text-amber-900/80">
              Unresolved intake exceptions remain visible until governed, pending, or explicitly closed.
            </p>
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 border-amber-300 bg-white text-amber-950 hover:bg-amber-100"
          onClick={() => void reload()}
          disabled={loading}
          aria-label="Refresh authorized-channel accountability queue"
        >
          <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", loading && "animate-spin")} aria-hidden />
          Refresh
        </Button>
      </div>

      {error ? (
        <div className="mt-2 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800" role="alert">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>Accountability queue unavailable: {error}</span>
        </div>
      ) : (
        <>
          <div className="mt-2 flex flex-wrap gap-1.5" aria-live="polite">
            <Badge variant={summary.total > 0 ? "destructive" : "secondary"}>{summary.total} unresolved</Badge>
            <Badge variant="outline" className="border-amber-300 bg-white text-amber-900">
              {summary.critical} critical
            </Badge>
            <Badge variant="outline" className={cn("bg-white", summary.unowned > 0 && "border-red-300 text-red-800")}>
              {summary.unowned} unowned
            </Badge>
            <Badge variant="outline" className={cn("bg-white", summary.actionless > 0 && "border-red-300 text-red-800")}>
              {summary.actionless} no next action
            </Badge>
            <Badge variant="outline" className={cn("bg-white", summary.stale > 0 && "border-orange-300 text-orange-800")}>
              {summary.stale} stale 24h+
            </Badge>
          </div>

          {items.length > 0 ? (
            <details className="mt-2 rounded-md border border-amber-200 bg-white/90 px-3 py-2">
              <summary className="cursor-pointer text-xs font-medium text-amber-950">
                Review highest-risk exceptions
              </summary>
              <ul className="mt-2 space-y-1.5">
                {items.slice(0, 8).map((item) => (
                  <li key={`${item.item_source}:${item.source_record_id}`} className="rounded border border-gray-200 bg-white px-2 py-1.5 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono text-[11px] text-gray-700">{itemLabel(item)}</span>
                      <span className="text-[11px] text-gray-500">{formatAge(item.detected_at)} old · priority {item.priority_rank}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-gray-700">
                      <span><strong>State:</strong> {item.accountability_state}</span>
                      <span><strong>Owner:</strong> {item.assigned_team || "MISSING"}</span>
                    </div>
                    <p className="mt-1 text-gray-700"><strong>Next:</strong> {item.effective_next_action || "MISSING"}</p>
                    <p className="mt-1 font-mono text-[10px] text-gray-500">source {item.source_message_id}{item.existing_intake_id ? ` · intake ${item.existing_intake_id}` : ""}</p>
                  </li>
                ))}
              </ul>
              {items.length > 8 ? <p className="mt-2 text-[11px] text-amber-900">Showing 8 of {items.length} unresolved items.</p> : null}
            </details>
          ) : loading ? (
            <p className="mt-2 text-xs text-amber-900">Loading accountability queue…</p>
          ) : (
            <p className="mt-2 text-xs font-medium text-green-800">No unresolved authorized-channel exceptions.</p>
          )}
        </>
      )}
    </section>
  );
}
