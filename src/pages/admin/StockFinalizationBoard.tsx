import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
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
import { OperationalTimeline } from "@/components/admin/OperationalTimeline";
import { GovernanceBoardLiveNotice } from "@/components/admin/GovernanceBoardLiveNotice";
import {
  GovernanceBlockingReasons,
  GovernanceMissingSignals,
  GovernancePrerequisiteChecklist,
} from "@/components/admin/GovernanceBoardPrerequisites";
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

function StockOrderCard({
  input,
  canExecuteWrites,
  busy,
  activeOrderId,
  onFinalize,
}: {
  input: StockFinalizationInput;
  canExecuteWrites: boolean;
  busy: boolean;
  activeOrderId: string | null;
  onFinalize: (input: StockFinalizationInput) => void;
}) {
  const projection = projectStockFinalization(input);
  const primaryReservation = input.reservations[0];

  return (
    <Card className="ring-1 ring-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between gap-2">
          <span>Order …{input.orderId.slice(-4)}</span>
          <Badge>{projection.finalizationStatus}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <GovernancePrerequisiteChecklist
          items={[
            {
              label: "Order status dispatched",
              satisfied: input.orderStatus === "dispatched",
              detail: input.orderStatus,
            },
            {
              label: "Dispatch release finalized",
              satisfied: input.dispatchReleaseStatus === "dispatch_finalized",
              detail: input.dispatchReleaseStatus,
            },
            {
              label: "Scan reference",
              satisfied: Boolean(input.scanReference?.trim()),
              detail: input.scanReference ?? "missing",
            },
            {
              label: "Gate reference",
              satisfied: Boolean(input.gateReference?.trim()),
              detail: input.gateReference ?? "missing",
            },
            {
              label: "Consumable reservations",
              satisfied: projection.canFinalizeConsumption || input.reservations.length > 0,
              detail: `${input.reservations.length} reservation(s)`,
            },
          ]}
        />

        <div className="rounded-md border border-border/60 bg-muted/20 p-2 text-xs space-y-1">
          <p className="font-medium">Dispatch lineage linkage</p>
          <p>
            Lineage id:{" "}
            {input.dispatchLineageId ? (
              <code>{input.dispatchLineageId.slice(0, 8)}…</code>
            ) : (
              <span className="text-destructive">missing — finalize dispatch on 4E first</span>
            )}
          </p>
          <p>Gate ref: {input.gateReference?.trim() || "—"}</p>
          <p>Scan ref: {input.scanReference?.trim() || "—"}</p>
        </div>

        <div className="rounded-md border border-border/60 bg-muted/20 p-2 text-xs space-y-1">
          <p className="font-medium">Reservation linkage</p>
          {input.reservations.length === 0 ? (
            <p className="text-destructive">No inventory_reservations rows for this order</p>
          ) : (
            <ul className="list-inside list-disc">
              {input.reservations.map((r) => (
                <li key={r.id}>
                  {r.reservationNumber} · {r.sku} · {r.reservationStatus} · reserved {r.reservedQty}
                </li>
              ))}
            </ul>
          )}
        </div>

        <GovernanceBlockingReasons reasons={projection.blockingReasons} title="Exact blockers" />
        {projection.warnings.length > 0 && (
          <p className="text-muted-foreground text-xs">Warnings: {projection.warnings.join(", ")}</p>
        )}

        <div className="flex flex-wrap gap-2 text-xs">
          <span>Reconciliation: {projection.reconciliationStatus}</span>
          <span>Consumable qty: {projection.consumedQty}</span>
          {primaryReservation && (
            <span>
              SKU {primaryReservation.sku} @ {input.locationCode}
            </span>
          )}
        </div>

        <Button
          disabled={
            busy ||
            activeOrderId === input.orderId ||
            !projection.canFinalizeConsumption ||
            !canExecuteWrites
          }
          onClick={() => onFinalize(input)}
        >
          {busy && activeOrderId === input.orderId ? "Finalizing…" : "Finalize consumption"}
        </Button>
        {!projection.canFinalizeConsumption && (
          <p className="text-xs text-muted-foreground">
            Button disabled until: dispatch_finalized, verified scan reference, reconciled reservations, and stock
            balance available.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function StockFinalizationBoard() {
  const { user, role } = useAuth();
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [selected, setSelected] = useState<"finalized" | "pending">("finalized");
  const [message, setMessage] = useState<string | null>(null);
  const [events, setEvents] = useState<OperationalEventRecord[]>([]);
  const [lineageCount, setLineageCount] = useState(0);
  const [bundle, setBundle] = useState<StockFinalizationBundle | null>(null);

  const boardState = useGovernanceBoardState(
    supabase,
    loadStockFinalizationRows,
    PREVIEW_ROWS,
    ["orders", "inventory_reservations", "inventory_stock_balances", "stock_consumption_lineage"],
  );

  const cardRows = useMemo(() => {
    if (boardState.liveRows.length > 0) {
      return boardState.liveRows.map((row) => ({
        input: row.input,
        missingSignals: row.missingSignals,
        projection: projectStockFinalization(row.input),
      }));
    }
    if (boardState.showPreviewCards) {
      const input = selected === "finalized" ? PREVIEW_STOCK_FINALIZED : PREVIEW_STOCK_PENDING;
      return [
        {
          input,
          missingSignals: [] as string[],
          projection: projectStockFinalization(input),
        },
      ];
    }
    return [];
  }, [boardState.liveRows, boardState.showPreviewCards, selected]);

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

  const showPreviewToggle = boardState.showPreviewCards && boardState.liveRows.length === 0;

  async function handleFinalize(input: StockFinalizationInput) {
    const projection = projectStockFinalization(input);
    if (!canExecuteWrites || !bundle) {
      setMessage(
        "Physical stock writes are disabled until Phase 4G migrations are applied and Supabase persistence is available (or VITE_STOCK_FINALIZATION_DEMO=true for controlled demo only).",
      );
      return;
    }
    if (!projection.canFinalizeConsumption) {
      setMessage(projection.blockingReasons.join(" · ") || "Consumption blocked by governance prerequisites.");
      return;
    }
    const reservation = input.reservations[0];
    if (!reservation || !input.scanReference) {
      setMessage("Blocked: missing reservation or scan reference.");
      return;
    }
    setBusyOrderId(input.orderId);
    setMessage(null);
    try {
      const ctx = {
        correlationId: `ui-4g-${Date.now()}`,
        actorUserId: user?.id ?? "00000000-0000-4000-8000-000000000099",
        actorRole: role ?? "UNKNOWN",
        finalizeReason: "Governed UI finalize",
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
      boardState.reload();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Finalization failed");
    } finally {
      setBusyOrderId(null);
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

      {boardState.meta.missingSignals.length > 0 && (
        <Card>
          <CardContent className="pt-4">
            <GovernanceMissingSignals signals={boardState.meta.missingSignals} title="Board-level missing signals" />
          </CardContent>
        </Card>
      )}

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

      <div className="grid gap-4 md:grid-cols-2">
        {cardRows.map(({ input, missingSignals }) => (
          <div key={input.orderId} className="space-y-2">
            <GovernanceMissingSignals signals={missingSignals} />
            <StockOrderCard
              input={input}
              canExecuteWrites={canExecuteWrites}
              busy={busyOrderId !== null}
              activeOrderId={busyOrderId}
              onFinalize={(row) => void handleFinalize(row)}
            />
          </div>
        ))}
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
