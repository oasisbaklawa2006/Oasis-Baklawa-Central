import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Factory, PlusCircle, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { rgsGovernedRpc } from "@/lib/rgsGovernedRpc";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const nonB2bDemandSources = ["pna", "outlet", "internal"] as const;
const PRODUCT_ID_QUERY_CHUNK_SIZE = 100;

// inventory_reservations is not yet present in Central's generated Database
// snapshot. Keep the temporary boundary ONLY for that relation; products is
// present in the generated schema and is queried through the typed client.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const reservationDb = supabase as unknown as { from: (relation: string) => any };

type ProductRow = Database["public"]["Tables"]["products"]["Row"];
type DemandProduct = Pick<ProductRow, "id" | "name" | "production_department">;

type Reservation = {
  id: string;
  product_id: string;
  sku: string;
  requested_qty: number;
  reserved_qty: number;
  fulfilled_qty: number;
  released_qty: number;
  reservation_status: string;
  product: Pick<DemandProduct, "name" | "production_department"> | null;
};

type ReservationCoverage = Pick<
  Reservation,
  "requested_qty" | "reserved_qty" | "fulfilled_qty" | "released_qty"
>;

type SkuDemand = {
  key: string;
  sku: string;
  productName: string;
  department: string | null;
  totalShortage: number;
  reservationIds: string[];
};

/**
 * Core release_rgs_reservation decrements reserved_qty and increments
 * released_qty in the same transaction. Therefore released_qty is historical
 * evidence, not additional current coverage. Subtracting it again would hide
 * newly-uncovered demand after a release.
 */
export function calculateOpenReservationShortage(reservation: ReservationCoverage): number {
  const requested = Math.max(0, Number(reservation.requested_qty));
  const reserved = Math.max(0, Number(reservation.reserved_qty));
  const fulfilled = Math.max(0, Number(reservation.fulfilled_qty));
  return Math.max(0, requested - reserved - fulfilled);
}

/**
 * RGS PC capability #6 (Production Demand Planner): a standalone SKU-wise
 * consolidated view of open RGS shortages, rather than routing shortage per
 * demand row inline (as ReadyGoodsStore.tsx still does for a single
 * customer order). create_production_shortage_demand is itself per-
 * reservation and idempotent (no duplicate open job per reservation +
 * department), so "route all" here is a safe batch of the same governed
 * call, not a new backend contract.
 */
export default function RgsProductionDemandPlanner() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    // inventory_reservations.product_id carries no FK to products (by
    // design -- see the schema), so PostgREST's embedded-resource syntax
    // ("product:products(...)") cannot resolve this join: it fails with
    // "Could not find a relationship between 'inventory_reservations' and
    // 'products' in the schema cache". Fetch reservations and products as
    // two plain queries and join them client-side instead of adding an FK
    // solely to satisfy PostgREST's embedding.
    const { data: reservationRows, error: loadError } = await reservationDb
      .from("inventory_reservations")
      .select("id, product_id, sku, requested_qty, reserved_qty, fulfilled_qty, released_qty, reservation_status")
      .in("reservation_status", ["pending", "partially_reserved"])
      .order("created_at", { ascending: true })
      .limit(1000);
    if (loadError) {
      setError(loadError.message ?? "Unexpected demand planner error");
      setReservations([]);
      setLoading(false);
      return;
    }
    const rows = (reservationRows ?? []) as Omit<Reservation, "product">[];
    const productIds = Array.from(new Set(rows.map((r) => r.product_id))).filter(Boolean);
    let productMap = new Map<string, Pick<DemandProduct, "name" | "production_department">>();
    if (productIds.length > 0) {
      const allProductRows: DemandProduct[] = [];
      // Supabase/PostgREST serializes `.in()` values into the request URL.
      // With up to 1000 reservations, sending every UUID in a single filter
      // can exceed common proxy/request-line limits and turn a valid planner
      // load into HTTP 414. Keep each request bounded and merge the results.
      for (let offset = 0; offset < productIds.length; offset += PRODUCT_ID_QUERY_CHUNK_SIZE) {
        const productIdChunk = productIds.slice(offset, offset + PRODUCT_ID_QUERY_CHUNK_SIZE);
        const { data: productRows, error: productError } = await supabase
          .from("products")
          .select("id, name, production_department")
          .in("id", productIdChunk);
        if (productError) {
          setError(productError.message ?? "Unexpected demand planner error");
          setReservations([]);
          setLoading(false);
          return;
        }
        allProductRows.push(...(productRows ?? []));
      }
      productMap = new Map(
        allProductRows.map((p) => [p.id, { name: p.name, production_department: p.production_department }]),
      );
    }
    setReservations(rows.map((r) => ({ ...r, product: productMap.get(r.product_id) ?? null })));
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const skuDemand = useMemo(() => {
    const byKey = new Map<string, SkuDemand>();
    for (const reservation of reservations) {
      const shortage = calculateOpenReservationShortage(reservation);
      if (shortage <= 0) continue;
      const department = reservation.product?.production_department ?? null;
      const key = `${reservation.sku}::${department ?? "unmapped"}`;
      const existing = byKey.get(key);
      if (existing) {
        existing.totalShortage += shortage;
        existing.reservationIds.push(reservation.id);
      } else {
        byKey.set(key, {
          key, sku: reservation.sku, productName: reservation.product?.name ?? reservation.sku,
          department, totalShortage: shortage, reservationIds: [reservation.id],
        });
      }
    }
    return Array.from(byKey.values()).sort((a, b) => b.totalShortage - a.totalShortage);
  }, [reservations]);

  const handleRouteAll = useCallback(async (demand: SkuDemand) => {
    if (!demand.department) { toast.error(`${demand.sku} has no production department mapped`); return; }
    setActing(demand.key);
    let routed = 0;
    let failed = 0;
    for (const reservationId of demand.reservationIds) {
      const { error: rpcError } = await rgsGovernedRpc.rpc("create_production_shortage_demand", {
        p_reservation_id: reservationId,
        p_department: demand.department,
        p_priority: "normal",
        p_correlation_id: crypto.randomUUID(),
      });
      if (rpcError) failed += 1; else routed += 1;
    }
    if (failed > 0) toast.warning(`Routed ${routed} reservation(s); ${failed} failed`);
    else toast.success(`Routed ${routed} reservation(s) for ${demand.sku} to ${demand.department}`);
    void load();
    setActing(null);
  }, [load]);

  const [raiseForm, setRaiseForm] = useState({ sku: "", qty: "", demandSourceType: "pna" as (typeof nonB2bDemandSources)[number], reference: "" });
  const [raising, setRaising] = useState(false);

  const handleRaiseDemand = useCallback(async () => {
    const qty = Number(raiseForm.qty);
    if (!raiseForm.sku.trim()) { toast.error("Enter a SKU"); return; }
    if (!qty || qty <= 0) { toast.error("Enter a valid quantity"); return; }
    setRaising(true);
    try {
      const { data: product, error: productError } = await supabase
        .from("products")
        .select("id, sku")
        .eq("sku", raiseForm.sku.trim())
        .maybeSingle();
      if (productError || !product) { toast.error(`No product found for SKU ${raiseForm.sku}`); return; }
      const { error: rpcError } = await rgsGovernedRpc.rpc("reserve_rgs_stock", {
        p_reservation_number: `RGS-${raiseForm.demandSourceType.toUpperCase()}-${Date.now().toString(36).toUpperCase()}`,
        p_order_id: null,
        p_product_id: product.id,
        p_sku: product.sku,
        p_requested_qty: qty,
        p_source_department: raiseForm.demandSourceType.toUpperCase(),
        p_correlation_id: crypto.randomUUID(),
        p_priority: "normal",
        p_location_code: "FINISHED_GOODS",
        p_queue_item_id: null,
        p_customer_id: null,
        p_demand_source_type: raiseForm.demandSourceType,
        p_demand_reference: raiseForm.reference.trim() || null,
      });
      if (rpcError) { toast.error(rpcError.message || "Could not raise demand"); return; }
      toast.success(`Raised ${qty} ${product.sku} demand for ${raiseForm.demandSourceType}`);
      setRaiseForm({ sku: "", qty: "", demandSourceType: raiseForm.demandSourceType, reference: "" });
      void load();
    } finally {
      setRaising(false);
    }
  }, [raiseForm, load]);

  const totalShortage = skuDemand.reduce((sum, row) => sum + row.totalShortage, 0);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 pb-24">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Production Demand Planner</h1>
          <p className="text-xs text-muted-foreground">SKU-wise consolidated RGS shortage — route the exact unreserved gap to Production</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh
        </Button>
      </header>

      {error && <Card className="border-destructive/40"><CardContent className="flex items-center gap-2 p-4 text-sm text-destructive"><AlertTriangle className="h-4 w-4" />Demand could not be read: {error}</CardContent></Card>}

      <Card><CardContent className="flex items-center gap-3 p-4"><Factory className="h-5 w-5 text-primary" /><div><p className="text-2xl font-bold">{fmt(totalShortage)}</p><p className="text-xs text-muted-foreground">Total open shortage across {skuDemand.length} SKU{skuDemand.length === 1 ? "" : "s"}</p></div></CardContent></Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><PlusCircle className="h-4 w-4 text-primary" />Raise P&amp;A / outlet / internal demand</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          <Input placeholder="SKU" className="h-8 w-36 text-xs" value={raiseForm.sku} onChange={(e) => setRaiseForm((prev) => ({ ...prev, sku: e.target.value }))} />
          <Input type="number" step="0.001" placeholder="Quantity" className="h-8 w-28 text-xs" value={raiseForm.qty} onChange={(e) => setRaiseForm((prev) => ({ ...prev, qty: e.target.value }))} />
          <Select value={raiseForm.demandSourceType} onValueChange={(value) => setRaiseForm((prev) => ({ ...prev, demandSourceType: value as (typeof nonB2bDemandSources)[number] }))}>
            <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{nonB2bDemandSources.map((type) => <SelectItem key={type} value={type} className="uppercase">{type}</SelectItem>)}</SelectContent>
          </Select>
          <Input placeholder="Reference (plan id / outlet code / requisition #)" className="h-8 w-64 text-xs" value={raiseForm.reference} onChange={(e) => setRaiseForm((prev) => ({ ...prev, reference: e.target.value }))} />
          <Button size="sm" disabled={raising} onClick={() => void handleRaiseDemand()}>{raising ? "Working…" : "Raise demand"}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Consolidated demand by SKU</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Product</TableHead><TableHead>SKU</TableHead><TableHead>Department</TableHead><TableHead className="text-right">Shortage</TableHead><TableHead className="text-right">Reservations</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {skuDemand.map((row) => (
                <TableRow key={row.key}>
                  <TableCell className="text-sm font-semibold">{row.productName}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{row.sku}</TableCell>
                  <TableCell>{row.department ? <Badge variant="outline">{row.department}</Badge> : <Badge variant="destructive">Unmapped</Badge>}</TableCell>
                  <TableCell className="text-right font-semibold">{fmt(row.totalShortage)}</TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">{row.reservationIds.length}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" disabled={!row.department || acting === row.key} onClick={() => void handleRouteAll(row)}>
                      {acting === row.key ? "Working…" : "Route to production"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!loading && !error && !skuDemand.length && <p className="py-8 text-center text-sm text-muted-foreground">No open RGS shortage — every reservation is fully covered.</p>}
        </CardContent>
      </Card>
    </div>
  );
}

function fmt(value: number) { return Number(value).toLocaleString("en-IN", { maximumFractionDigits: 3 }); }
