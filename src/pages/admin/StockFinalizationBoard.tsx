import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { PackageMinus, ShieldCheck, AlertTriangle, ClipboardList } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { requiresStockOverrideReason } from "@/lib/stock-authority/stockAuthorityGuard";
import {
  FORBIDDEN_STOCK_UI_PATTERNS,
  projectStockFinalization,
  createStockFinalizationBundle,
  createStockFinalizationService,
  createInMemoryStockBalanceRepository,
  createInMemoryStockMovementRepository,
  createInMemoryStockLineageRepository,
  createInMemoryStockFinalizationEventSink,
  type StockFinalizationBundle,
  type StockFinalizationInput,
} from "@/lib/stock-finalization";
import { createSupabaseStockBalanceRepository } from "@/lib/stock-finalization/supabaseStockFinalizationStore";
import { OperationalTimeline } from "@/components/admin/OperationalTimeline";
import { GovernanceBoardLiveNotice } from "@/components/admin/GovernanceBoardLiveNotice";
import { GovernancePrerequisiteList } from "@/components/admin/GovernancePrerequisiteList";
import type { OperationalEventRecord } from "@/lib/operational-events/types";
import {
  loadStockFinalizationRows,
  PREVIEW_STOCK_FINALIZED,
  PREVIEW_STOCK_PENDING,
  useGovernanceBoardState,
} from "@/lib/execution-read-models";
import { PREVIEW_STOCK_RESERVATION } from "@/lib/execution-read-models/governanceBoardSamples";

export const FORBIDDEN_STOCK_UI_LABELS = [
  "Silent Deduct",
  "Auto Adjust",
  "Delete Ledger",
  "Force Balance",
  "Capture Payment",
  "Generate Invoice",
] as const;

const PREVIEW_ROWS = [
  { input: PREVIEW_STOCK_FINALIZED, missingSignals: [] as string[] },
  { input: PREVIEW_STOCK_PENDING, missingSignals: [] as string[] },
];

function stockEventsToOperational(
  records: {
    id: string;
    title: string;
    message: string;
    occurredAt: string;
    eventType: string;
    orderId: string;
  }[],
): OperationalEventRecord[] {
  return records.map((e, i) => ({
    id: e.id,
    kind: e.eventType,
    category: "operational" as const,
    severity: "info" as const,
    title: e.title,
    detail: e.message,
    occurredAt: e.occurredAt,
    sortKey: i,
    source: "manual" as const,
    actor: { role: "operator" as const, displayLabel: "Stock finalization" },
    entities: [{ entityType: "order" as const, id: e.orderId }],
  }));
}

function createDemoStockService() {
  return createStockFinalizationService({
    balances: createInMemoryStockBalanceRepository([
      {
        id: "bal-demo",
        productId: PREVIEW_STOCK_RESERVATION.productId,
        sku: PREVIEW_STOCK_RESERVATION.sku,
        locationCode: "WH-MAIN",
        availableQty: 50,
        reservedQty: 12,
        damagedQty: 0,
        expiredQty: 0,
        quarantineQty: 0,
        version: 1,
        updatedAt: new Date().toISOString(),
      },
    ]),
    movements: createInMemoryStockMovementRepository(),
    lineage: createInMemoryStockLineageRepository(),
    events: createInMemoryStockFinalizationEventSink(),
  });
}

export default function StockFinalizationBoard() {
  const { user, role } = useAuth();
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<"finalized" | "pending">("finalized");
  const [message, setMessage] = useState<string | null>(null);
  const [overrideReason, setOverrideReason] = useState("");
  const [events, setEvents] = useState<OperationalEventRecord[]>([]);
  const [lineageCount, setLineageCount] = useState(0);
  const [bundle, setBundle] = useState<StockFinalizationBundle | null>(null);

  const boardState = useGovernanceBoardState(
    supabase,
    loadStockFinalizationRows,
    PREVIEW_ROWS,
    ["orders", "inventory_reservations", "inventory_stock_balances", "stock_consumption_lineage"],
  );

  const activeRow = useMemo(() => {
    if (boardState.liveRows.length > 0) return boardState.liveRows[0];
    if (boardState.showPreviewCards) {
      const previewInput = selected === "finalized" ? PREVIEW_STOCK_FINALIZED : PREVIEW_STOCK_PENDING;
      return { input: previewInput, missingSignals: [] as string[] };
    }
    return null;
  }, [boardState.liveRows, boardState.showPreviewCards, selected]);

  const input = activeRow?.input ?? null;
  const missingSignals = activeRow?.missingSignals ?? [];

  const projection = useMemo(
    () => (input ? projectStockFinalization(input) : null),
    [input],
  );

  const primaryReservation = input?.reservations[0] ?? PREVIEW_STOCK_RESERVATION;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (import.meta.env.VITE_STOCK_FINALIZATION_DEMO === "true") {
        const demo = await createStockFinalizationBundle(undefined, { forceInMemory: true });
        if (!cancelled) {
          setBundle({
            ...demo,
            service: createDemoStockService(),
            canExecuteWrites: true,
          });
        }
        return;
      }
      const loaded = await createStockFinalizationBundle(supabase);
      if (!cancelled) setBundle(loaded);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const canExecuteWrites = bundle?.canExecuteWrites ?? false;
  const requiresOverrideReason = requiresStockOverrideReason(role);

  const overrideReasonReady = !requiresOverrideReason || overrideReason.trim().length > 0;

  const finalizeBlockers = useMemo(() => {
    if (!projection || !input) return [];
    const reasons = [...projection.blockingReasons, ...missingSignals];
    if (!canExecuteWrites) {
      reasons.push("Physical stock writes unavailable — Phase 4G persistence or demo flag required.");
    }
    if (!input.dispatchLineageId) {
      reasons.push("dispatchLineageId missing — finalize dispatch on 4E first (dispatch_release_lineage).");
    }
    if (!input.scanReference?.trim()) {
      reasons.push("scanReference missing — verified carton/packing/gate scan on operational_scan_records.");
    }
    if (input.reservations.length === 0) {
      reasons.push("No inventory_reservations linked to this order.");
    }
    if (requiresOverrideReason && !overrideReason.trim()) {
      reasons.push("SUPER_ADMIN override reason required — type overrideReason before finalizing consumption.");
    }
    return [...new Set(reasons)];
  }, [projection, input, missingSignals, canExecuteWrites, requiresOverrideReason, overrideReason]);

  const persistenceLabel =
    bundle?.persistenceMode === "supabase"
      ? "Supabase persistence"
      : bundle?.persistenceMode === "demo"
        ? "Demo in-memory (non-production)"
        : "Persistence unavailable";

  const showPreviewToggle = boardState.showPreviewCards && boardState.liveRows.length === 0;

  async function handleFinalize() {
    if (!input || !projection) return;
    if (!canExecuteWrites || !bundle) {
      setMessage(
        "Physical stock writes are disabled until Phase 4G migrations are applied and Supabase persistence is available (or VITE_STOCK_FINALIZATION_DEMO=true for controlled demo only).",
      );
      return;
    }
    if (!projection.canFinalizeConsumption) {
      setMessage("Blocked: dispatch must be finalized with scan evidence and consumable reservations.");
      return;
    }
    const reservation = input.reservations[0];
    if (!reservation || !input.scanReference) {
      setMessage("Blocked: missing reservation or scan reference.");
      return;
    }
    if (requiresOverrideReason && !overrideReason.trim()) {
      setMessage("SUPER_ADMIN requires typed overrideReason for stock actions.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      let expectedBalanceVersion = 1;
      if (bundle.persistenceMode === "supabase") {
        const balances = createSupabaseStockBalanceRepository(supabase);
        const balanceRow = await balances.getBalance(
          reservation.productId,
          reservation.sku,
          input.locationCode,
        );
        if (balanceRow) {
          expectedBalanceVersion = balanceRow.version;
        }
      }

      const ctx = {
        correlationId: `ui-4g-${Date.now()}`,
        actorUserId: user?.id ?? "00000000-0000-4000-8000-000000000099",
        actorRole: role ?? "UNKNOWN",
        finalizeReason: "Governed UI finalize",
        overrideReason: requiresOverrideReason ? overrideReason.trim() : null,
      };
      await bundle.service.finalizeConsumption(
        input,
        {
          orderId: input.orderId,
          scanReference: input.scanReference,
          gateReference: input.gateReference,
          dispatchLineageId: input.dispatchLineageId,
          items: [
            {
              reservationId: reservation.id,
              productId: reservation.productId,
              sku: reservation.sku,
              locationCode: input.locationCode,
              consumeQty: reservation.reservedQty,
              expectedBalanceVersion,
            },
          ],
        },
        ctx,
      );
      const evts = await bundle.service.listEvents(input.orderId);
      setEvents(stockEventsToOperational(evts));
      const lineage = await bundle.service.listLineage(input.orderId);
      setLineageCount(lineage.length);
      setMessage("Consumption finalized — physical deduction recorded in governed ledger.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Finalization failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Stock finalization</h1>
          <p className="text-muted-foreground text-sm">
            Governed physical deduction after dispatch_finalized — internal only.
          </p>
        </div>
        <Badge variant="outline" className="gap-1">
          <ShieldCheck className="h-3 w-3" />
          Phase 4G
        </Badge>
      </div>

      <GovernanceBoardLiveNotice
        meta={boardState.meta}
        loading={boardState.loading}
        loadError={boardState.loadError}
        showEmptyLiveMessage={boardState.showEmptyLiveMessage}
        showUnavailableMessage={boardState.showUnavailableMessage}
        showPreviewCards={boardState.showPreviewCards}
      />

      <Card className="border-amber-200/60 bg-amber-50/30 dark:bg-amber-950/20">
        <CardContent className="pt-4 text-sm space-y-1">
          <p>
            <strong>{persistenceLabel}.</strong> Live rows load from Supabase when tables exist; preview cards require{" "}
            <code className="text-xs">VITE_EXECUTION_PREVIEW_FALLBACK=true</code>.
          </p>
          <p>
            Stock mutations require dispatch finalization, reservation reconciliation, and scan evidence.
            No payment, invoice, or customer notification on this board.
            <Link to="/admin/dispatch-finalization" className="ml-1 underline">
              Dispatch finalization
            </Link>
          </p>
        </CardContent>
      </Card>

      {showPreviewToggle && (
        <div className="flex gap-2">
          <Button
            variant={selected === "finalized" ? "default" : "outline"}
            size="sm"
            onClick={() => setSelected("finalized")}
          >
            Dispatch finalized (ready)
          </Button>
          <Button
            variant={selected === "pending" ? "default" : "outline"}
            size="sm"
            onClick={() => setSelected("pending")}
          >
            Pre-finalization (blocked)
          </Button>
        </div>
      )}

      {input && projection && (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ClipboardList className="h-4 w-4" />
                  Reconciliation — …{input.orderId.slice(-4)}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span>Status</span>
                  <Badge>{projection.finalizationStatus}</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Reconciliation</span>
                  <span>{projection.reconciliationStatus}</span>
                </div>
                <div className="flex justify-between">
                  <span>Consumable qty</span>
                  <span>{projection.consumedQty}</span>
                </div>
                <GovernancePrerequisiteList
                  title="Missing prerequisites"
                  items={finalizeBlockers}
                  variant={finalizeBlockers.length > 0 ? "destructive" : "default"}
                />
                {projection.warnings.length > 0 && (
                  <p className="text-muted-foreground">Warnings: {projection.warnings.join(", ")}</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <PackageMinus className="h-4 w-4" />
                  Dispatch lineage & handoff
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-1 font-mono text-[11px]">
                <p>
                  dispatchLineageId:{" "}
                  {input.dispatchLineageId?.trim() ? input.dispatchLineageId : "— missing (4E finalize) —"}
                </p>
                <p>gateReference: {input.gateReference?.trim() ? input.gateReference : "— missing —"}</p>
                <p>scanReference: {input.scanReference?.trim() ? input.scanReference : "— missing —"}</p>
                <p>orderStatus: {input.orderStatus}</p>
                <p>dispatchRelease: {input.dispatchReleaseStatus.replace(/_/g, " ")}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Reservation linkage</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              {input.reservations.length === 0 ? (
                <p className="text-destructive flex items-center gap-2 text-xs">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  No inventory_reservations for this order.
                </p>
              ) : (
                <ul className="space-y-2 text-xs">
                  {input.reservations.map((r) => (
                    <li key={r.id} className="rounded border border-border/50 p-2">
                      <p className="font-medium">{r.reservationNumber}</p>
                      <p className="font-mono text-muted-foreground">id: {r.id}</p>
                      <p>
                        SKU {r.sku} · reserved {r.reservedQty} · status {r.reservationStatus}
                      </p>
                      <p>Location: {input.locationCode}</p>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-2 text-muted-foreground text-[10px]">
                Primary SKU preview: {primaryReservation.sku} · reserved {primaryReservation.reservedQty}
              </p>
            </CardContent>
          </Card>

          {requiresOverrideReason && (
            <div className="space-y-2 max-w-xl">
              <Label htmlFor="stock-override-reason">
                Override reason <span className="text-destructive">*</span>
              </Label>
              <Input
                id="stock-override-reason"
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Typed SUPER_ADMIN override (required for stock actions)"
                autoComplete="off"
              />
              <p className="text-muted-foreground text-[10px]">
                Separate from finalizeReason — required by stock authority guard for SUPER_ADMIN.
              </p>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {!projection.canFinalizeConsumption && finalizeBlockers.length > 0 && (
              <p className="w-full text-[10px] text-destructive">
                Finalize consumption disabled until dispatch is finalized, scan evidence exists, and reservations
                reconcile.
              </p>
            )}
            {requiresOverrideReason && !overrideReasonReady && (
              <p className="w-full text-[10px] text-destructive">
                Enter override reason before finalizing consumption.
              </p>
            )}
            <Button
              disabled={
                busy ||
                !projection.canFinalizeConsumption ||
                !canExecuteWrites ||
                !overrideReasonReady
              }
              onClick={() => void handleFinalize()}
            >
              Finalize consumption
            </Button>
            <Button variant="outline" disabled title="Requires typed reversalReason via inventory manager">
              Request reversal
            </Button>
          </div>
        </>
      )}

      {message && <p className="text-sm">{message}</p>}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Forbidden on this surface</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {FORBIDDEN_STOCK_UI_LABELS.map((label) => (
            <Badge key={label} variant="secondary">
              {label}
            </Badge>
          ))}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Code guard patterns blocked: {FORBIDDEN_STOCK_UI_PATTERNS.join(", ")}
      </p>

      {(events.length > 0 || lineageCount > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Movement timeline (internal)</CardTitle>
          </CardHeader>
          <CardContent>
            <OperationalTimeline events={events} />
            <p className="text-muted-foreground mt-2 text-xs">Lineage rows: {lineageCount}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
