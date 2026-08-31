import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, RefreshCw, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// Temporary typed boundary until project-wide generated Supabase definitions
// include the production-certified R4.4 authority from Core #161.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const inventoryDb = supabase as unknown as { from: (relation: string) => any; rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> };

type ReceiptLineIdentity = { id: string; product_id: string; sku: string };
type StockBalance = { product_id: string; sku: string; available_qty: number; quarantine_qty: number };
type ExceptionAction = "quarantine" | "release_quarantine" | "damage_writeoff" | "return_to_vendor";
type SourceBucket = "available" | "quarantine";
type Draft = { action: ExceptionAction; sourceBucket: SourceBucket; quantity: string; reason: string };

const DEFAULT_DRAFT: Draft = { action: "quarantine", sourceBucket: "available", quantity: "", reason: "" };

function sourceForAction(action: ExceptionAction, current: SourceBucket): SourceBucket {
  if (action === "quarantine") return "available";
  if (action === "release_quarantine") return "quarantine";
  return current;
}

function newCorrelation(lineId: string): string {
  const suffix = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `3pgs-exception:${lineId}:${suffix}`;
}

export default function ThreePgsInventoryExceptionPanel({
  receiptId,
  destinationStoreCode,
  grnFinalisedAt,
  reloadParent,
}: {
  receiptId: string;
  destinationStoreCode: string;
  grnFinalisedAt: string | null;
  reloadParent: () => Promise<void>;
}) {
  const [lines, setLines] = useState<ReceiptLineIdentity[]>([]);
  const [balances, setBalances] = useState<StockBalance[]>([]);
  const [drafts, setDrafts] = useState<Map<string, Draft>>(new Map());
  const [correlations, setCorrelations] = useState<Map<string, string>>(new Map());
  const [busyLineId, setBusyLineId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const enabled = destinationStoreCode === "3PGS" && Boolean(grnFinalisedAt);

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setActionError(null);
    try {
      const lineResult = await inventoryDb.from("b2b_inventory_receipt_lines")
        .select("id, product_id, sku")
        .eq("receipt_id", receiptId)
        .order("created_at", { ascending: true });
      if (lineResult.error) throw lineResult.error;
      const nextLines = (lineResult.data ?? []) as ReceiptLineIdentity[];
      setLines(nextLines);
      if (!nextLines.length) { setBalances([]); return; }
      const balanceResult = await inventoryDb.from("inventory_stock_balances")
        .select("product_id, sku, available_qty, quarantine_qty")
        .eq("location_code", "3PGS")
        .in("product_id", Array.from(new Set(nextLines.map((line) => line.product_id))));
      if (balanceResult.error) throw balanceResult.error;
      setBalances((balanceResult.data ?? []) as StockBalance[]);
    } catch (cause) {
      setLines([]);
      setBalances([]);
      setActionError(cause instanceof Error ? cause.message : "3PGS exception balances could not be loaded");
      throw cause;
    } finally {
      setLoading(false);
    }
  }, [enabled, receiptId]);

  useEffect(() => { void load().catch(() => undefined); }, [load]);

  const balanceByIdentity = useMemo(() => new Map(balances.map((balance) => [`${balance.product_id}:${balance.sku}`, balance])), [balances]);
  const draftFor = (lineId: string) => drafts.get(lineId) ?? DEFAULT_DRAFT;

  const updateDraft = (lineId: string, patch: Partial<Draft>) => {
    setDrafts((current) => {
      const next = new Map(current);
      const existing = next.get(lineId) ?? DEFAULT_DRAFT;
      const action = patch.action ?? existing.action;
      const nextDraft = { ...existing, ...patch, action, sourceBucket: sourceForAction(action, patch.sourceBucket ?? existing.sourceBucket) };
      next.set(lineId, nextDraft);
      return next;
    });
    // Any semantic edit represents a new intended command. Failed/uncertain retries
    // retain their correlation key only while the draft remains unchanged.
    setCorrelations((current) => { const next = new Map(current); next.delete(lineId); return next; });
    setSuccess(null);
  };

  const submit = async (line: ReceiptLineIdentity) => {
    const draft = draftFor(line.id);
    const quantity = Number(draft.quantity);
    const reason = draft.reason.trim();
    const balance = balanceByIdentity.get(`${line.product_id}:${line.sku}`);
    const available = Number(balance?.available_qty ?? 0);
    const quarantine = Number(balance?.quarantine_qty ?? 0);
    const sourceQuantity = draft.sourceBucket === "available" ? available : quarantine;

    if (!Number.isFinite(quantity) || quantity <= 0) { setActionError("Enter a positive exception quantity."); return; }
    if (!reason) { setActionError("Enter a reason before submitting the inventory exception."); return; }
    if (!balance) { setActionError("No canonical 3PGS balance exists for this SKU."); return; }
    if (quantity > sourceQuantity) { setActionError(`Quantity exceeds the ${draft.sourceBucket} balance.`); return; }

    const correlationId = correlations.get(line.id) ?? newCorrelation(line.id);
    if (!correlations.has(line.id)) setCorrelations((current) => new Map(current).set(line.id, correlationId));
    setBusyLineId(line.id);
    setActionError(null);
    setSuccess(null);
    try {
      const { error } = await inventoryDb.rpc("record_b2b_3pgs_inventory_exception", {
        p_product_id: line.product_id,
        p_sku: line.sku,
        p_action: draft.action,
        p_source_bucket: draft.sourceBucket,
        p_quantity: quantity,
        p_reason: reason,
        p_correlation_id: correlationId,
        p_evidence: [],
      });
      if (error) { setActionError(error.message); return; }

      // Core success is authoritative. From this point forward, the command is
      // committed and must never be represented as safe to retry.
      setCorrelations((current) => { const next = new Map(current); next.delete(line.id); return next; });
      setDrafts((current) => { const next = new Map(current); next.set(line.id, DEFAULT_DRAFT); return next; });
      setSuccess(`${line.sku} exception recorded through governed 3PGS authority.`);

      try {
        await Promise.all([load(), reloadParent()]);
      } catch (cause) {
        setActionError(cause instanceof Error ? `3PGS exception recorded, but refresh failed: ${cause.message}` : "3PGS exception recorded, but refresh failed");
      }
    } catch (cause) {
      // Keep correlationId in state: only an uncertain RPC result is retryable.
      // A post-success refresh failure is handled above and never reaches here.
      setActionError(cause instanceof Error ? cause.message : "3PGS inventory exception failed");
    } finally {
      setBusyLineId(null);
    }
  };

  if (destinationStoreCode !== "3PGS") return null;

  if (!grnFinalisedAt) {
    return (
      <section data-testid="3pgs-inventory-exception-panel" className="rounded-lg border border-amber-500/30 bg-amber-500/[0.04] p-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold"><ShieldAlert className="h-4 w-4 text-amber-600" />Post-GRN 3PGS exceptions</h2>
        <p className="mt-1 text-xs text-muted-foreground">Quarantine, release, damage write-off and return-to-vendor become available only after the GRN is finalised.</p>
      </section>
    );
  }

  return (
    <section data-testid="3pgs-inventory-exception-panel" className="space-y-3 rounded-lg border border-amber-500/30 bg-amber-500/[0.04] p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold"><ShieldAlert className="h-4 w-4 text-amber-600" />Post-GRN 3PGS exceptions</h2>
          <p className="text-xs text-muted-foreground">All stock mutation is executed by the production-certified Core authority. This screen never writes balances directly.</p>
        </div>
        <Button size="sm" variant="outline" disabled={loading || busyLineId !== null} onClick={() => void load().catch(() => undefined)}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh balances</Button>
      </div>
      {actionError && <p className="flex items-center gap-2 rounded border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive"><AlertTriangle className="h-4 w-4" />{actionError}</p>}
      {success && <p className="rounded border border-primary/30 bg-primary/5 p-2 text-xs text-primary">{success}</p>}
      <div className="space-y-3">
        {lines.map((line) => {
          const draft = draftFor(line.id);
          const balance = balanceByIdentity.get(`${line.product_id}:${line.sku}`);
          const sourceLocked = draft.action === "quarantine" || draft.action === "release_quarantine";
          return (
            <div key={line.id} className="space-y-3 rounded-md border bg-background p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold">{line.sku}</p>
                <div className="flex gap-2 text-xs"><Badge variant="outline">Available {Number(balance?.available_qty ?? 0).toLocaleString("en-IN")}</Badge><Badge variant="outline">Quarantine {Number(balance?.quarantine_qty ?? 0).toLocaleString("en-IN")}</Badge></div>
              </div>
              <div className="grid gap-2 md:grid-cols-[190px_150px_120px_1fr_auto]">
                <select aria-label={`Exception action for ${line.sku}`} className="rounded border bg-background px-2 py-2 text-sm" value={draft.action} onChange={(event) => updateDraft(line.id, { action: event.target.value as ExceptionAction })}>
                  <option value="quarantine">Quarantine</option>
                  <option value="release_quarantine">Release quarantine</option>
                  <option value="damage_writeoff">Damage write-off</option>
                  <option value="return_to_vendor">Return to vendor</option>
                </select>
                <select aria-label={`Source bucket for ${line.sku}`} className="rounded border bg-background px-2 py-2 text-sm disabled:opacity-60" disabled={sourceLocked} value={draft.sourceBucket} onChange={(event) => updateDraft(line.id, { sourceBucket: event.target.value as SourceBucket })}>
                  <option value="available">Available</option>
                  <option value="quarantine">Quarantine</option>
                </select>
                <input aria-label={`Exception quantity for ${line.sku}`} className="rounded border bg-background px-2 py-2 text-sm" type="number" min="0" step="any" placeholder="Qty" value={draft.quantity} onChange={(event) => updateDraft(line.id, { quantity: event.target.value })} />
                <input aria-label={`Exception reason for ${line.sku}`} className="rounded border bg-background px-2 py-2 text-sm" placeholder="Reason / evidence note" value={draft.reason} onChange={(event) => updateDraft(line.id, { reason: event.target.value })} />
                <Button size="sm" disabled={busyLineId !== null || !balance} onClick={() => void submit(line)}>{busyLineId === line.id ? "Recording…" : "Record"}</Button>
              </div>
            </div>
          );
        })}
        {!loading && !lines.length && <p className="py-4 text-center text-xs text-muted-foreground">No receipt lines are available for post-GRN exception handling.</p>}
      </div>
    </section>
  );
}
