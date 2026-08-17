import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Factory, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { rgsGovernedRpc } from "@/lib/rgsGovernedRpc";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// Temporary typed boundary for live relations pending regenerated
// project-wide Supabase definitions (matches the operationsDb pattern used
// elsewhere in the RGS surfaces).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const planningDb = supabase as unknown as { from: (relation: string) => any };

type Reservation = {
  id: string;
  product_id: string;
  sku: string;
  requested_qty: number;
  reserved_qty: number;
  fulfilled_qty: number;
  released_qty: number;
  reservation_status: string;
  product: { name: string; production_department: string | null } | null;
};

type SkuDemand = {
  key: string;
  sku: string;
  productName: string;
  department: string | null;
  totalShortage: number;
  reservationIds: string[];
};

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
    const { data, error: loadError } = await planningDb
      .from("inventory_reservations")
      .select("id, product_id, sku, requested_qty, reserved_qty, fulfilled_qty, released_qty, reservation_status, product:products(name, production_department)")
      .in("reservation_status", ["pending", "partially_reserved"])
      .order("created_at", { ascending: true })
      .limit(1000);
    if (loadError) {
      setError(loadError.message ?? "Unexpected demand planner error");
      setReservations([]);
    } else {
      setReservations((data ?? []) as Reservation[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const skuDemand = useMemo(() => {
    const byKey = new Map<string, SkuDemand>();
    for (const reservation of reservations) {
      const shortage = Number(reservation.requested_qty) - Number(reservation.reserved_qty)
        - Number(reservation.fulfilled_qty) - Number(reservation.released_qty);
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
          {!loading && !skuDemand.length && <p className="py-8 text-center text-sm text-muted-foreground">No open RGS shortage — every reservation is fully covered.</p>}
        </CardContent>
      </Card>
    </div>
  );
}

function fmt(value: number) { return Number(value).toLocaleString("en-IN", { maximumFractionDigits: 3 }); }
