import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { PackageMinus, ShieldCheck, AlertTriangle, ClipboardList } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
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
import type { StockReservationRecord } from "@/lib/stock-finalization/stockReservationTypes";
import { OperationalTimeline } from "@/components/admin/OperationalTimeline";
import type { OperationalEventRecord } from "@/lib/operational-events/types";

export const FORBIDDEN_STOCK_UI_LABELS = [
  "Silent Deduct",
  "Auto Adjust",
  "Delete Ledger",
  "Force Balance",
  "Capture Payment",
  "Generate Invoice",
] as const;

const SAMPLE_RESERVATION: StockReservationRecord = {
  id: "00000000-0000-4000-8000-000000000801",
  reservationNumber: "RSV-4G-001",
  orderId: "00000000-0000-4000-8000-000000000601",
  productId: "00000000-0000-4000-8000-000000000701",
  sku: "BAK-4G-DEMO",
  requestedQty: 12,
  reservedQty: 12,
  fulfilledQty: 0,
  releasedQty: 0,
  reservationStatus: "reserved",
};

const SAMPLE_FINALIZED: StockFinalizationInput = {
  orderId: "00000000-0000-4000-8000-000000000601",
  orderStatus: "dispatched",
  dispatchReleaseStatus: "dispatch_finalized",
  reservations: [SAMPLE_RESERVATION],
  scanReference: "PACK-SCAN-4G-001",
  gateReference: "GATE-4G-001",
  dispatchLineageId: "drl-4g-001",
  locationCode: "WH-MAIN",
};

const SAMPLE_PENDING: StockFinalizationInput = {
  ...SAMPLE_FINALIZED,
  orderId: "00000000-0000-4000-8000-000000000602",
  orderStatus: "cleared_for_dispatch",
  dispatchReleaseStatus: "dispatch_release_ready",
  scanReference: null,
};

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
        productId: SAMPLE_RESERVATION.productId,
        sku: SAMPLE_RESERVATION.sku,
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
  const [events, setEvents] = useState<OperationalEventRecord[]>([]);
  const [lineageCount, setLineageCount] = useState(0);
  const [bundle, setBundle] = useState<StockFinalizationBundle | null>(null);

  const input = selected === "finalized" ? SAMPLE_FINALIZED : SAMPLE_PENDING;
  const projection = useMemo(() => projectStockFinalization(input), [input]);

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
  const persistenceLabel =
    bundle?.persistenceMode === "supabase"
      ? "Supabase persistence"
      : bundle?.persistenceMode === "demo"
        ? "Demo in-memory (non-production)"
        : "Persistence unavailable";

  async function handleFinalize() {
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
    setBusy(true);
    setMessage(null);
    try {
      const ctx = {
        correlationId: `ui-4g-${Date.now()}`,
        actorUserId: user?.id ?? "00000000-0000-4000-8000-000000000099",
        actorRole: role ?? "UNKNOWN",
        finalizeReason: "Governed UI finalize (staging)",
      };
      await bundle.service.finalizeConsumption(
        input,
        {
          orderId: input.orderId,
          scanReference: input.scanReference!,
          gateReference: input.gateReference,
          dispatchLineageId: input.dispatchLineageId,
          items: [
            {
              reservationId: SAMPLE_RESERVATION.id,
              productId: SAMPLE_RESERVATION.productId,
              sku: SAMPLE_RESERVATION.sku,
              locationCode: input.locationCode,
              consumeQty: 12,
              expectedBalanceVersion: 1,
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

      <Card className="border-amber-200/60 bg-amber-50/30 dark:bg-amber-950/20">
        <CardContent className="pt-4 text-sm space-y-1">
          <p>
            <strong>{persistenceLabel}.</strong> Sample order data is for projection preview only — not live
            production orders unless wired to Supabase.
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

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="h-4 w-4" />
              Reconciliation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
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
            {projection.blockingReasons.length > 0 && (
              <div className="text-destructive flex gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{projection.blockingReasons.join(", ")}</span>
              </div>
            )}
            {projection.warnings.length > 0 && (
              <p className="text-muted-foreground">Warnings: {projection.warnings.join(", ")}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <PackageMinus className="h-4 w-4" />
              Balance preview
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <p>SKU: {SAMPLE_RESERVATION.sku}</p>
            <p>Location: {input.locationCode}</p>
            <p>Reserved: {SAMPLE_RESERVATION.reservedQty}</p>
            <p className="text-muted-foreground">Optimistic lock on finalize (version)</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          disabled={busy || !projection.canFinalizeConsumption || !canExecuteWrites}
          onClick={() => void handleFinalize()}
        >
          Finalize consumption
        </Button>
        <Button variant="outline" disabled title="Requires typed reversalReason via inventory manager">
          Request reversal
        </Button>
      </div>

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
