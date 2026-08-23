import { useCallback, useEffect, useState } from "react";
import { PackageCheck, RefreshCw, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { dispatchGovernedRpc } from "@/lib/dispatchGovernedRpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// Temporary typed boundary for `b2b_dispatch_shipment_execution_view`,
// pending regenerated project-wide Supabase definitions -- same escape
// hatch pattern as ReadyGoodsStore.tsx / ThirdPartyPackingMaterialCatalogue.tsx.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const dispatchDb = supabase as unknown as { from: (relation: string) => any };

type ShipmentExecutionRow = {
  consignment_id: string;
  consignment_number: string;
  order_id: string;
  order_number: string;
  consignment_status: string;
  dispatch_mode: string;
  consignee_name: string | null;
  destination_city: string | null;
  carton_count: number;
  selected_qty: number;
  packed_qty: number;
  dispatched_qty: number;
  transporter_name: string | null;
  finance_status: "CLEARED" | "HOLD";
  open_exception_count: number;
};

const DISPATCH_MODES = [
  "road_transporter",
  "courier",
  "air",
  "train",
  "direct_special_delivery",
  "customer_pickup",
  "approved_special",
] as const;

/**
 * Governed Dispatch execution preview -- verification/ops tool giving the
 * new b2b_dispatch_* governed RPCs (create_b2b_dispatch_consignment,
 * open_b2b_dispatch_carton, create_b2b_dispatch_shipment, added
 * 20260822140000/20260822150000/20260823120000) and the shipment-scoped
 * read view (b2b_dispatch_shipment_execution_view, added 20260822130000)
 * real, reachable callers instead of dead scaffolding.
 *
 * This does NOT touch, replace, or duplicate the live legacy Dispatch
 * screens (DispatchManagement.tsx, AdminPackingDispatch.tsx, etc.), which
 * keep writing to `dispatches`/`dispatch_cartons` exactly as before. It is
 * a separate, additive surface for starting/inspecting governed
 * consignments while the legacy-to-governed migration continues one
 * operation at a time. Route: /admin/dispatch-governed-preview.
 */
export default function DispatchGovernedExecutionPreview() {
  const [rows, setRows] = useState<ShipmentExecutionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [orderId, setOrderId] = useState("");
  const [dispatchMode, setDispatchMode] = useState<string>(DISPATCH_MODES[0]);
  const [orderItemId, setOrderItemId] = useState("");
  const [selectedQty, setSelectedQty] = useState("");
  const [creating, setCreating] = useState(false);
  const [createCorrelationId, setCreateCorrelationId] = useState(() => crypto.randomUUID());

  const [cartonConsignmentId, setCartonConsignmentId] = useState("");
  const [cartonCode, setCartonCode] = useState("");
  const [openingCarton, setOpeningCarton] = useState(false);

  const [shipmentConsignmentId, setShipmentConsignmentId] = useState("");
  const [transporterName, setTransporterName] = useState("");
  const [trackingLrAwb, setTrackingLrAwb] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [creatingShipment, setCreatingShipment] = useState(false);
  const [shipmentCorrelationId, setShipmentCorrelationId] = useState(() => crypto.randomUUID());

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await dispatchDb
        .from("b2b_dispatch_shipment_execution_view")
        .select("*")
        .order("consignment_number", { ascending: false })
        .limit(50);
      if (fetchError) throw fetchError;
      setRows((data ?? []) as ShipmentExecutionRow[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load governed dispatch consignments.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  const handleCreateConsignment = async () => {
    const trimmedOrderId = orderId.trim();
    const trimmedOrderItemId = orderItemId.trim();
    const qty = Number(selectedQty);
    if (!trimmedOrderId || !trimmedOrderItemId) {
      toast.error("Order ID and order item ID are required.");
      return;
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      toast.error("Selected quantity must be a positive number.");
      return;
    }
    setCreating(true);
    try {
      const { error: rpcError } = await dispatchGovernedRpc.rpc("create_b2b_dispatch_consignment", {
        p_order_id: trimmedOrderId,
        p_dispatch_mode: dispatchMode,
        p_lines: [{ order_item_id: trimmedOrderItemId, selected_qty: qty }],
        p_correlation_id: createCorrelationId,
      });
      if (rpcError) throw new Error(rpcError.message);
      toast.success("Governed dispatch consignment created.");
      setOrderId("");
      setOrderItemId("");
      setSelectedQty("");
      setCreateCorrelationId(crypto.randomUUID());
      await fetchRows();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create the consignment.");
    } finally {
      setCreating(false);
    }
  };

  const handleOpenCarton = async () => {
    const trimmedConsignmentId = cartonConsignmentId.trim();
    const trimmedCartonCode = cartonCode.trim();
    if (!trimmedConsignmentId || !trimmedCartonCode) {
      toast.error("Select a consignment and enter a carton code.");
      return;
    }
    setOpeningCarton(true);
    try {
      const { error: rpcError } = await dispatchGovernedRpc.rpc("open_b2b_dispatch_carton", {
        p_consignment_id: trimmedConsignmentId,
        p_carton_code: trimmedCartonCode,
      });
      if (rpcError) throw new Error(rpcError.message);
      toast.success("Carton opened.");
      setCartonCode("");
      await fetchRows();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to open the carton.");
    } finally {
      setOpeningCarton(false);
    }
  };

  const handleCreateShipment = async () => {
    const trimmedConsignmentId = shipmentConsignmentId.trim();
    const trimmedTransporter = transporterName.trim();
    const trimmedTracking = trackingLrAwb.trim();
    if (!trimmedConsignmentId) {
      toast.error("Select a consignment.");
      return;
    }
    if (!trimmedTransporter || !trimmedTracking) {
      toast.error("Transporter name and tracking / LR / AWB number are required.");
      return;
    }
    setCreatingShipment(true);
    try {
      const { error: rpcError } = await dispatchGovernedRpc.rpc("create_b2b_dispatch_shipment", {
        p_consignment_id: trimmedConsignmentId,
        p_transporter_name: trimmedTransporter,
        p_tracking_lr_awb: trimmedTracking,
        p_correlation_id: shipmentCorrelationId,
        p_vehicle_number: vehicleNumber.trim() || null,
        p_driver_name: driverName.trim() || null,
        p_driver_phone: driverPhone.trim() || null,
      });
      if (rpcError) throw new Error(rpcError.message);
      toast.success("Shipment recorded.");
      setTransporterName("");
      setTrackingLrAwb("");
      setVehicleNumber("");
      setDriverName("");
      setDriverPhone("");
      setShipmentCorrelationId(crypto.randomUUID());
      await fetchRows();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to record the shipment.");
    } finally {
      setCreatingShipment(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 pb-24">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <PackageCheck className="h-7 w-7 text-primary" aria-hidden />
          <h1 className="text-xl font-bold tracking-tight">Dispatch governed execution preview</h1>
          <Badge variant="outline" className="text-[10px] uppercase">
            b2b_dispatch_* verification tool
          </Badge>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void fetchRows()} disabled={loading}>
          <RefreshCw className={`mr-1 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden />
          Refresh
        </Button>
      </header>

      <Card className="border-amber-500/40 bg-amber-500/5">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm text-amber-900 dark:text-amber-100">
            <ShieldAlert className="h-4 w-4" aria-hidden />
            Governed migration surface -- legacy Dispatch screens unaffected
          </CardTitle>
          <CardDescription className="text-xs">
            Starts consignments via the governed RPCs added in this migration programme. Does not read from or
            write to the legacy <code>dispatches</code>/<code>dispatch_cartons</code> tables.
          </CardDescription>
        </CardHeader>
      </Card>

      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Start a governed consignment</CardTitle>
          <CardDescription className="text-xs">
            Calls <code>create_b2b_dispatch_consignment</code>. Requires an existing order with a company and an
            order item on it.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="dispatch-preview-order-id">Order ID</Label>
            <Input
              id="dispatch-preview-order-id"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              placeholder="uuid"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="dispatch-preview-dispatch-mode">Dispatch mode</Label>
            <Select value={dispatchMode} onValueChange={setDispatchMode}>
              <SelectTrigger id="dispatch-preview-dispatch-mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DISPATCH_MODES.map((mode) => (
                  <SelectItem key={mode} value={mode}>
                    {mode}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="dispatch-preview-order-item-id">Order item ID</Label>
            <Input
              id="dispatch-preview-order-item-id"
              value={orderItemId}
              onChange={(e) => setOrderItemId(e.target.value)}
              placeholder="uuid"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="dispatch-preview-selected-qty">Selected quantity</Label>
            <Input
              id="dispatch-preview-selected-qty"
              type="number"
              min="0"
              value={selectedQty}
              onChange={(e) => setSelectedQty(e.target.value)}
            />
          </div>
          <Button
            type="button"
            className="sm:col-span-2"
            disabled={creating}
            onClick={() => void handleCreateConsignment()}
          >
            {creating ? "Creating…" : "Create consignment"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Open a carton</CardTitle>
          <CardDescription className="text-xs">
            Calls <code>open_b2b_dispatch_carton</code>. Only opens the carton header -- no weight/photo/item
            evidence capture yet.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="dispatch-preview-carton-consignment">Consignment</Label>
            <Select value={cartonConsignmentId} onValueChange={setCartonConsignmentId}>
              <SelectTrigger id="dispatch-preview-carton-consignment">
                <SelectValue placeholder="Select a consignment" />
              </SelectTrigger>
              <SelectContent>
                {rows.map((row) => (
                  <SelectItem key={row.consignment_id} value={row.consignment_id}>
                    {row.consignment_number}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="dispatch-preview-carton-code">Carton code</Label>
            <Input
              id="dispatch-preview-carton-code"
              value={cartonCode}
              onChange={(e) => setCartonCode(e.target.value)}
              placeholder="e.g. CTN-0001"
            />
          </div>
          <Button
            type="button"
            className="sm:col-span-2"
            disabled={openingCarton}
            onClick={() => void handleOpenCarton()}
          >
            {openingCarton ? "Opening…" : "Open carton"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Record a shipment</CardTitle>
          <CardDescription className="text-xs">
            Calls <code>create_b2b_dispatch_shipment</code>. Records real transport evidence against a consignment --
            does not transition consignment status (no RPC does yet; see the migration's own comment on why).
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="dispatch-preview-shipment-consignment">Consignment</Label>
            <Select value={shipmentConsignmentId} onValueChange={setShipmentConsignmentId}>
              <SelectTrigger id="dispatch-preview-shipment-consignment">
                <SelectValue placeholder="Select a consignment" />
              </SelectTrigger>
              <SelectContent>
                {rows.map((row) => (
                  <SelectItem key={row.consignment_id} value={row.consignment_id}>
                    {row.consignment_number}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="dispatch-preview-transporter-name">Transporter name</Label>
            <Input
              id="dispatch-preview-transporter-name"
              value={transporterName}
              onChange={(e) => setTransporterName(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="dispatch-preview-tracking-lr-awb">Tracking / LR / AWB</Label>
            <Input
              id="dispatch-preview-tracking-lr-awb"
              value={trackingLrAwb}
              onChange={(e) => setTrackingLrAwb(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="dispatch-preview-vehicle-number">Vehicle number (optional)</Label>
            <Input
              id="dispatch-preview-vehicle-number"
              value={vehicleNumber}
              onChange={(e) => setVehicleNumber(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="dispatch-preview-driver-name">Driver name (optional)</Label>
            <Input
              id="dispatch-preview-driver-name"
              value={driverName}
              onChange={(e) => setDriverName(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="dispatch-preview-driver-phone">Driver phone (optional)</Label>
            <Input
              id="dispatch-preview-driver-phone"
              value={driverPhone}
              onChange={(e) => setDriverPhone(e.target.value)}
            />
          </div>
          <Button
            type="button"
            className="sm:col-span-2"
            disabled={creatingShipment}
            onClick={() => void handleCreateShipment()}
          >
            {creatingShipment ? "Recording…" : "Record shipment"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Governed consignments</CardTitle>
          <CardDescription className="text-xs">
            Read from <code>b2b_dispatch_shipment_execution_view</code>. Finance status is always collapsed to
            CLEARED/HOLD.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!loading && rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No governed consignments yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Consignment</TableHead>
                    <TableHead>Order</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Cartons</TableHead>
                    <TableHead>Selected / Packed / Dispatched</TableHead>
                    <TableHead>Finance</TableHead>
                    <TableHead>Exceptions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.consignment_id}>
                      <TableCell className="text-xs">{row.consignment_number}</TableCell>
                      <TableCell className="text-xs">{row.order_number}</TableCell>
                      <TableCell className="text-xs">{row.consignment_status}</TableCell>
                      <TableCell className="text-xs">{row.carton_count}</TableCell>
                      <TableCell className="text-xs">
                        {row.selected_qty} / {row.packed_qty} / {row.dispatched_qty}
                      </TableCell>
                      <TableCell className="text-xs">
                        <Badge variant={row.finance_status === "CLEARED" ? "default" : "outline"}>
                          {row.finance_status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{row.open_exception_count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
