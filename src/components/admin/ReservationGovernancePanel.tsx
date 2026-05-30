import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Loader2, Package, ScanLine, Warehouse } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GovernancePrerequisiteList } from "@/components/admin/GovernancePrerequisiteList";
import { createAndReserveInventoryForOrder } from "@/lib/inventory-reservations/createGovernedReservation";
import {
  buildReservationCreateBlockers,
  loadDispatchedOrdersForReservationBoard,
  loadOrderLinesForReservation,
  loadReservationBoardOrderContext,
  reservationContextKey,
  reservationContextMatchesSelection,
  reservationLineKey,
  RESERVATION_BOARD_DEFAULT_LOCATION,
  type ReservationLineCandidate,
  type ReservationOrderRow,
} from "@/lib/inventory-reservations/reservationBoardQueries";
import {
  recordVerifiedScanForStockFinalization,
  seedInitialStockBalance,
} from "@/lib/inventory-reservations/reservationStagingPrerequisites";
import { createSupabaseReservationService } from "@/lib/inventory-reservations/supabaseReservationRepository";
import { probeInventoryReservationTables } from "@/lib/inventory-reservations/supabaseInventoryReservationStore";
import { reservationStatusLabel } from "@/lib/inventory-reservations/reservationProjection";
import { ReservationError } from "@/lib/inventory-reservations/reservationTypes";

export function ReservationGovernancePanel() {
  const { user, role } = useAuth();
  const [tablesOk, setTablesOk] = useState<boolean | null>(null);
  const [orders, setOrders] = useState<ReservationOrderRow[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string>("");
  const [orderLines, setOrderLines] = useState<ReservationLineCandidate[]>([]);
  const [selectedLine, setSelectedLine] = useState<ReservationLineCandidate | null>(null);
  const [locationCode, setLocationCode] = useState(RESERVATION_BOARD_DEFAULT_LOCATION);
  const [reserveQty, setReserveQty] = useState("");
  const [scanBarcode, setScanBarcode] = useState("");
  const [seedAvailableQty, setSeedAvailableQty] = useState("");
  const [loading, setLoading] = useState(false);
  const [contextLoading, setContextLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [context, setContext] = useState<Awaited<ReturnType<typeof loadReservationBoardOrderContext>> | null>(
    null,
  );

  const writeCtx = useCallback(
    () => ({
      correlationId: `ui-4f-reservation-${Date.now()}`,
      actorUserId: user?.id ?? "00000000-0000-4000-8000-000000000099",
      actorRole: role ?? "UNKNOWN",
      actorDepartment: "reservation_board",
    }),
    [user?.id, role],
  );

  const reloadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const ok = await probeInventoryReservationTables(supabase);
      setTablesOk(ok);
      if (!ok) {
        setOrders([]);
        return;
      }
      const rows = await loadDispatchedOrdersForReservationBoard(supabase);
      setOrders(rows);
      if (!selectedOrderId && rows[0]) setSelectedOrderId(rows[0].id);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed to load orders");
    } finally {
      setLoading(false);
    }
  }, [selectedOrderId]);

  useEffect(() => {
    void reloadOrders();
  }, [reloadOrders]);

  const handleOrderChange = useCallback((orderId: string) => {
    setSelectedOrderId(orderId);
    setSelectedLine(null);
    setOrderLines([]);
    setContext(null);
    setContextLoading(false);
  }, []);

  const clearReservationContext = useCallback(() => {
    setContext(null);
    setContextLoading(false);
  }, []);

  useEffect(() => {
    if (!selectedOrderId) {
      setOrderLines([]);
      setSelectedLine(null);
      return;
    }
    let cancelled = false;
    void loadOrderLinesForReservation(supabase, selectedOrderId)
      .then((lines) => {
        if (cancelled) return;
        setOrderLines(lines);
        setSelectedLine((prev) => {
          if (prev && lines.some((l) => reservationLineKey(l) === reservationLineKey(prev))) return prev;
          return lines[0] ?? null;
        });
      })
      .catch((e) => {
        if (!cancelled) setMessage(e instanceof Error ? e.message : "Failed to load order lines");
      });
    return () => {
      cancelled = true;
    };
  }, [selectedOrderId]);

  useEffect(() => {
    if (!selectedLine) return;
    setReserveQty(String(selectedLine.quantity));
    setSeedAvailableQty(String(Math.max(selectedLine.quantity * 2, 50)));
  }, [selectedLine?.productId, selectedLine?.sku]);

  useEffect(() => {
    if (!selectedOrderId || !selectedLine) {
      setContext(null);
      setContextLoading(false);
      return;
    }
    const loadKey = reservationContextKey(selectedOrderId, selectedLine, locationCode);
    let cancelled = false;
    setContext(null);
    setContextLoading(true);
    void loadReservationBoardOrderContext(supabase, selectedOrderId, selectedLine, locationCode)
      .then((ctx) => {
        if (cancelled) return;
        const currentKey = reservationContextKey(selectedOrderId, selectedLine, locationCode);
        if (currentKey !== loadKey) return;
        setContext(ctx);
      })
      .catch((e) => {
        if (!cancelled) setMessage(e instanceof Error ? e.message : "Failed to load order context");
      })
      .finally(() => {
        setContextLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedOrderId, selectedLine, locationCode]);

  const parsedReserveQty = Number(reserveQty);
  const effectiveReserveQty =
    Number.isFinite(parsedReserveQty) && parsedReserveQty > 0 ? parsedReserveQty : (selectedLine?.quantity ?? 0);

  const reservationBlockers = useMemo(() => {
    if (!context || !selectedLine || !context.availabilitySummary) return [];
    return buildReservationCreateBlockers({
      order: context.order,
      line: selectedLine,
      reservations: context.reservations,
      availabilitySummary: context.availabilitySummary,
      reserveQty: effectiveReserveQty,
    });
  }, [context, selectedLine, effectiveReserveQty]);

  const canWrite = tablesOk === true && Boolean(user?.id);

  const contextMatchesSelection = reservationContextMatchesSelection(
    context,
    selectedOrderId,
    selectedLine,
    locationCode,
  );

  const canCreateAndReserve =
    canWrite &&
    Boolean(selectedLine) &&
    contextMatchesSelection &&
    Boolean(context) &&
    !contextLoading &&
    busy === null &&
    reservationBlockers.length === 0;

  const handleCreateAndReserve = async () => {
    if (!selectedOrderId || !selectedLine || !context || !contextMatchesSelection) return;
    const qty = Number(reserveQty);
    if (!Number.isFinite(qty) || qty <= 0) {
      setMessage("Quantity must be a positive number.");
      return;
    }
    if (reservationBlockers.length > 0) {
      setMessage("Blocked: resolve prerequisites before creating a reservation.");
      return;
    }
    setBusy("reserve");
    setMessage(null);
    try {
      const result = await createAndReserveInventoryForOrder(
        supabase,
        {
          orderId: selectedOrderId,
          productId: selectedLine.productId,
          sku: selectedLine.sku,
          quantity: qty,
          locationCode,
        },
        writeCtx(),
      );
      setMessage(
        `Reserved ${result.reservationNumber} · status ${result.reservationStatus} · qty ${result.reservedQty}. ` +
          `Movements: ${result.movementIds.length}. Continue on Stock finalization.`,
      );
      try {
        const refreshed = await loadReservationBoardOrderContext(
          supabase,
          selectedOrderId,
          selectedLine,
          locationCode,
        );
        setContext(refreshed);
        await reloadOrders();
      } catch (refreshErr) {
        setMessage(
          (prev) =>
            `${prev ?? ""} Warning: reservation saved but UI refresh failed: ${
              refreshErr instanceof Error ? refreshErr.message : "unknown error"
            }`,
        );
      }
    } catch (e) {
      if (e instanceof ReservationError) {
        setMessage(`Reservation blocked (${e.code}): ${e.message}`);
      } else {
        setMessage(e instanceof Error ? e.message : "Reservation failed");
      }
    } finally {
      setBusy(null);
    }
  };

  const handleSeedScan = async () => {
    if (!selectedOrderId) return;
    setBusy("scan");
    setMessage(null);
    try {
      await recordVerifiedScanForStockFinalization(
        supabase,
        { orderId: selectedOrderId, barcodeValue: scanBarcode },
        writeCtx(),
      );
      setMessage("Verified carton scan recorded for 4G scanReference.");
      if (selectedLine) {
        const refreshed = await loadReservationBoardOrderContext(
          supabase,
          selectedOrderId,
          selectedLine,
          locationCode,
        );
        setContext(refreshed);
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Scan record failed");
    } finally {
      setBusy(null);
    }
  };

  const handleSeedBalance = async () => {
    if (!selectedLine) return;
    const qty = Number(seedAvailableQty);
    if (!Number.isFinite(qty) || qty <= 0) {
      setMessage("Seed available qty must be positive.");
      return;
    }
    setBusy("balance");
    setMessage(null);
    try {
      const result = await seedInitialStockBalance(supabase, {
        productId: selectedLine.productId,
        sku: selectedLine.sku,
        locationCode,
        availableQty: qty,
      });
      setMessage(
        result.created
          ? `Initial balance opened at ${locationCode} · available ${result.balance.availableQty}.`
          : `Balance already exists at ${locationCode} · available ${result.balance.availableQty}.`,
      );
      const refreshed = await loadReservationBoardOrderContext(
        supabase,
        selectedOrderId,
        selectedLine,
        locationCode,
      );
      setContext(refreshed);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Balance seed failed");
    } finally {
      setBusy(null);
    }
  };

  const handleRefreshReservations = async () => {
    if (!selectedOrderId || !selectedLine) return;
    setBusy("refresh");
    setMessage(null);
    try {
      const svc = await createSupabaseReservationService(supabase).getService();
      const rows = await svc.listByOrder(selectedOrderId);
      const refreshed = await loadReservationBoardOrderContext(
        supabase,
        selectedOrderId,
        selectedLine,
        locationCode,
      );
      setContext({ ...refreshed, reservations: rows });
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed to refresh reservations");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="border-primary/30">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Package className="h-4 w-4" />
            Governed reservation create (4F)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p className="text-muted-foreground text-xs">
            Creates <code className="text-[10px]">inventory_reservations</code> and append-only{" "}
            <code className="text-[10px]">inventory_movements</code> via{" "}
            <code className="text-[10px]">createSupabaseReservationService</code> only. Does not finalize stock or
            write <code className="text-[10px]">stock_consumption_lineage</code>.
          </p>

          {tablesOk === false && (
            <p className="text-destructive text-xs flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Reservation tables unavailable — apply Phase 4A migration on staging.
            </p>
          )}

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-xs">Dispatched order</Label>
              <Select
                value={selectedOrderId}
                onValueChange={handleOrderChange}
                disabled={loading || !canWrite}
              >
                <SelectTrigger>
                  <SelectValue placeholder={loading ? "Loading…" : "Select order"} />
                </SelectTrigger>
                <SelectContent>
                  {orders.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Line / SKU</Label>
              <Select
                value={selectedLine ? reservationLineKey(selectedLine) : ""}
                onValueChange={(v) => {
                  const line = orderLines.find((l) => reservationLineKey(l) === v);
                  setSelectedLine(line ?? null);
                  clearReservationContext();
                }}
                disabled={!selectedOrderId || orderLines.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select line" />
                </SelectTrigger>
                <SelectContent>
                  {orderLines.map((l) => (
                    <SelectItem key={reservationLineKey(l)} value={reservationLineKey(l)}>
                      {l.sku} · {l.productName} · qty {l.quantity}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-2">
              <Label className="text-xs">Source location</Label>
              <Input
                value={locationCode}
                onChange={(e) => {
                  setLocationCode(e.target.value);
                  clearReservationContext();
                }}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Reserve quantity</Label>
              <Input
                type="number"
                min={0.001}
                step={1}
                value={reserveQty}
                onChange={(e) => setReserveQty(e.target.value)}
              />
            </div>
            <div className="space-y-2 flex items-end">
              <Button
                className="w-full"
                disabled={!canCreateAndReserve}
                onClick={() => void handleCreateAndReserve()}
              >
                {busy === "reserve" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create & reserve"}
              </Button>
            </div>
          </div>

          {contextLoading && (
            <p className="text-muted-foreground text-xs flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" /> Loading availability…
            </p>
          )}

          {!contextLoading && selectedLine && context && !contextMatchesSelection && (
            <p className="text-destructive text-xs">
              Availability context is stale — wait for reload after order, line, or location change.
            </p>
          )}

          {context && contextMatchesSelection && (
            <>
              <div className="rounded-md border border-border/60 bg-muted/20 p-3 space-y-2 text-xs font-mono">
                <p>orderId: {context.order.id}</p>
                <p>label: {context.order.label}</p>
                <p>product: {selectedLine?.sku}</p>
                <p>
                  availability: physical {context.availabilitySummary?.physicalStock ?? "—"} · open reserved{" "}
                  {context.availabilitySummary?.reservedOpen ?? "—"} · available{" "}
                  {context.availabilitySummary?.availableQty ?? "—"}
                </p>
                <p>
                  balance @ {context.locationCode}:{" "}
                  {context.balance
                    ? `avail ${context.balance.availableQty} · reserved ${context.balance.reservedQty} · v${context.balance.version}`
                    : "— none —"}
                </p>
                <p>scanReference: {context.scanReference ?? "— missing —"}</p>
              </div>

              <GovernancePrerequisiteList
                title="Reservation blockers"
                items={reservationBlockers}
                variant={reservationBlockers.length > 0 ? "destructive" : "default"}
              />

              {context.stockFinalizationHints.length > 0 && (
                <GovernancePrerequisiteList
                  title="Stock finalization (4G) prerequisites"
                  items={context.stockFinalizationHints}
                  variant="default"
                />
              )}

              {context.reservations.length > 0 && (
                <ul className="space-y-2 text-xs">
                  {context.reservations.map((r) => (
                    <li key={r.id} className="rounded border border-border/50 p-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{r.reservationNumber}</span>
                        <Badge variant="outline">{reservationStatusLabel(r.reservationStatus)}</Badge>
                      </div>
                      <p className="text-muted-foreground font-mono text-[10px]">id: {r.id}</p>
                      <p>
                        {r.sku} · requested {r.requestedQty} · reserved {r.reservedQty}
                      </p>
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => void handleRefreshReservations()} disabled={busy !== null}>
                  Refresh reservations
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/admin/stock-finalization">Open stock finalization (4G)</Link>
                </Button>
              </div>
            </>
          )}

          {message && <p className="text-sm">{message}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <ScanLine className="h-4 w-4" />
            Staging prerequisites (explicit — not bypass)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p className="text-muted-foreground text-xs">
            Use only when 4G blockers require scan or balance rows. Writes governed scan ledger and initial balance
            insert — no stock consumption.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-xs flex items-center gap-1">
                <ScanLine className="h-3 w-3" /> Verified carton barcode
              </Label>
              <Input
                placeholder="e.g. CTN-SO-2026-000002"
                value={scanBarcode}
                onChange={(e) => setScanBarcode(e.target.value)}
              />
              <Button
                variant="secondary"
                size="sm"
                disabled={!canWrite || !selectedOrderId || !scanBarcode.trim() || busy !== null}
                onClick={() => void handleSeedScan()}
              >
                {busy === "scan" ? <Loader2 className="h-3 w-3 animate-spin" /> : "Record verified scan"}
              </Button>
            </div>
            <div className="space-y-2">
              <Label className="text-xs flex items-center gap-1">
                <Warehouse className="h-3 w-3" /> Initial available qty @ {locationCode}
              </Label>
              <Input
                type="number"
                min={1}
                value={seedAvailableQty}
                onChange={(e) => setSeedAvailableQty(e.target.value)}
              />
              <Button
                variant="secondary"
                size="sm"
                disabled={!canWrite || !selectedLine || busy !== null}
                onClick={() => void handleSeedBalance()}
              >
                {busy === "balance" ? <Loader2 className="h-3 w-3 animate-spin" /> : "Open initial balance"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
