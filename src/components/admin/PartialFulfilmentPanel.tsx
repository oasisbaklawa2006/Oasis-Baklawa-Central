import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, Split } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  loadPartialFulfilmentFacts,
} from "@/lib/order-partial-fulfilment/partialFulfilmentQueries";
import {
  POINT76_CORE_PREREQUISITE,
  type PartialFulfilmentOrderProjection,
} from "@/lib/order-partial-fulfilment/partialFulfilmentTypes";

type PartialFulfilmentPanelProps = {
  orderId: string;
};

/** Point 76 — read-only partial/split fulfilment projection bound to Core facts. */
export function PartialFulfilmentPanel({ orderId }: PartialFulfilmentPanelProps) {
  const [projection, setProjection] = useState<PartialFulfilmentOrderProjection | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const facts = await loadPartialFulfilmentFacts(orderId);
      setProjection(facts);
    } catch (error) {
      setProjection(null);
      setLoadError(error instanceof Error ? error.message : "Could not load partial fulfilment facts");
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const authorityAbsent = projection?.authorityState !== "dispatch_line_facts_available";

  return (
    <section className="space-y-3 rounded-lg border border-border bg-muted/20 p-3" data-point="76">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <Split size={16} className="mt-0.5 shrink-0 text-sky-600" aria-hidden />
          <div>
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Partial / split fulfilment (Point 76)
            </h3>
            <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
              Read-only projection from Core dispatch-line, reservation and consignment facts. Mutations route only
              through governed RPC authority.
            </p>
          </div>
        </div>
        <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={function onRefreshClick() { void reload(); }} disabled={loading}>
          {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
        </Button>
      </div>

      {loadError && (
        <div className="rounded border border-destructive/40 bg-destructive/5 px-2 py-1.5 text-[11px] text-destructive">
          <p>{loadError}</p>
          <Button type="button" size="sm" variant="outline" className="mt-2 h-7 text-xs" onClick={function onRetryClick() { void reload(); }}>
            Retry
          </Button>
        </div>
      )}

      {authorityAbsent && !loadError && (
        <p className="rounded border border-amber-300/60 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-900">
          {POINT76_CORE_PREREQUISITE}
        </p>
      )}

      {projection && !loadError && (
        <div className="space-y-2 text-[11px]">
          <div className="flex flex-wrap gap-2 text-muted-foreground">
            <span>Partial: {projection.hasPartialFulfilment ? "yes" : "no"}</span>
            <span>Open remainder: {projection.hasOpenRemainder ? "yes" : "no"}</span>
            <span>Split consignments: {projection.hasSplitConsignments ? "yes" : "no"}</span>
            <span>Quantity conserved: {projection.quantityConserved ? "yes" : "no"}</span>
          </div>

          {projection.conservationViolations.length > 0 && (
            <ul className="list-disc space-y-1 pl-4 text-amber-900">
              {projection.conservationViolations.map(function renderViolation(message) {
                return <li key={message}>{message}</li>;
              })}
            </ul>
          )}

          {projection.lines.length === 0 ? (
            <p className="text-muted-foreground">No order lines to project.</p>
          ) : (
            <ul className="space-y-2">
              {projection.lines.map(function renderLine(line) {
                return (
                  <li key={line.orderItemId} className="rounded border border-border bg-background px-2 py-1.5">
                    <div className="font-mono text-[10px] text-muted-foreground">{line.orderItemId.slice(0, 8)}</div>
                    <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5">
                      <span>Ordered: {line.orderedQty}</span>
                      <span>Fulfilled: {line.fulfilledQty}</span>
                      <span>Packed: {line.packedQty}</span>
                      <span>Dispatched: {line.dispatchedQty}</span>
                      <span>Remainder: {line.remainderQty}</span>
                      <span>Disposition: {line.remainderDisposition}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
