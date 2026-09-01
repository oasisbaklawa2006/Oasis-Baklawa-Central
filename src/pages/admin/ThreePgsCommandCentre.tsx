import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Boxes, ClipboardList, PackageCheck, RefreshCw, Truck } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { dispatchDb as governedReadDb } from "@/lib/dispatchGovernedRpc";

export const THREE_PGS_STORE_CODE = "3PGS";

type Balance = {
  id: string;
  sku: string;
  location_code: string;
  available_qty: number;
  reserved_qty: number;
  picked_qty: number;
  damaged_qty: number;
  expired_qty: number;
  quarantine_qty: number;
};

type PriorityDemand = {
  demand_id: string;
  demand_reference: string;
  demand_source_type: string;
  priority_rank: number;
  sku: string;
  location_code: string;
  outstanding_qty: number;
};

type Procurement = {
  id: string;
  requirement_number: string;
  sku: string;
  destination_store_code: string;
  shortage_qty: number;
  fulfilled_qty: number;
  vendor_reference: string | null;
  expected_at: string | null;
  status: string;
};

type AssemblyRequirement = {
  id: string;
  requirement_number: string;
  sku: string;
  source_store_code: string;
  requested_qty: number;
  fulfilled_qty: number;
  status: string;
  priority: string;
};

type Receipt = {
  id: string;
  receipt_number: string;
  destination_store_code: string;
  status: string;
  created_at: string;
};

type Grn = {
  id: string;
  grn_number: string;
  receipt_id: string;
  status: string;
  finalised_at: string | null;
};

type Snapshot = {
  balances: Balance[];
  demand: PriorityDemand[];
  procurement: Procurement[];
  assembly: AssemblyRequirement[];
  receipts: Receipt[];
  grns: Grn[];
};

const EMPTY: Snapshot = { balances: [], demand: [], procurement: [], assembly: [], receipts: [], grns: [] };

export function threePgsCommandCentreMetrics(snapshot: Snapshot) {
  const available = snapshot.balances.reduce((sum, row) => sum + Number(row.available_qty || 0), 0);
  const reserved = snapshot.balances.reduce((sum, row) => sum + Number(row.reserved_qty || 0), 0);
  const exceptions = snapshot.balances.reduce(
    (sum, row) => sum + Number(row.damaged_qty || 0) + Number(row.expired_qty || 0) + Number(row.quarantine_qty || 0),
    0,
  );
  const openProcurement = snapshot.procurement.filter((row) => !["received", "cancelled", "closed"].includes(row.status)).length;
  const openAssembly = snapshot.assembly.filter((row) => ["open", "partially_fulfilled"].includes(row.status)).length;
  const receiptsAwaitingGrn = snapshot.receipts.filter((receipt) => {
    if (["cancelled", "rejected"].includes(receipt.status)) return false;
    return !snapshot.grns.some(
      (grn) => grn.receipt_id === receipt.id && (grn.status === "finalised" || grn.finalised_at !== null),
    );
  }).length;
  return { available, reserved, exceptions, openProcurement, openAssembly, receiptsAwaitingGrn };
}

export default function ThreePgsCommandCentre() {
  const [snapshot, setSnapshot] = useState<Snapshot>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [skuFilter, setSkuFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [balances, demand, procurement, assembly, receipts, grns] = await Promise.all([
        governedReadDb.from<Balance>("inventory_stock_balances")
          .select("id, sku, location_code, available_qty, reserved_qty, picked_qty, damaged_qty, expired_qty, quarantine_qty")
          .eq("location_code", THREE_PGS_STORE_CODE)
          .order("sku", { ascending: true })
          .limit(1000),
        governedReadDb.from<PriorityDemand>("b2b_3pgs_pending_demand_priority")
          .select("demand_id, demand_reference, demand_source_type, priority_rank, sku, location_code, outstanding_qty")
          .order("priority_rank", { ascending: true })
          .limit(100),
        governedReadDb.from<Procurement>("b2b_procurement_requirements")
          .select("id, requirement_number, sku, destination_store_code, shortage_qty, fulfilled_qty, vendor_reference, expected_at, status")
          .eq("destination_store_code", THREE_PGS_STORE_CODE)
          .order("created_at", { ascending: false })
          .limit(100),
        governedReadDb.from<AssemblyRequirement>("b2b_assembly_3pgs_requirements")
          .select("id, requirement_number, sku, source_store_code, requested_qty, fulfilled_qty, status, priority")
          .order("created_at", { ascending: true })
          .limit(100),
        governedReadDb.from<Receipt>("b2b_inventory_receipts")
          .select("id, receipt_number, destination_store_code, status, created_at")
          .eq("destination_store_code", THREE_PGS_STORE_CODE)
          .order("created_at", { ascending: false })
          .limit(100),
        governedReadDb.from<Grn>("b2b_inventory_grns")
          .select("id, grn_number, receipt_id, status, finalised_at")
          .order("created_at", { ascending: false })
          .limit(100),
      ]);

      const firstError = [balances, demand, procurement, assembly, receipts, grns]
        .find((result) => result.error !== null)?.error;
      if (firstError) throw new Error(firstError.message);

      const openAssemblyRows = (assembly.data ?? []).filter((row) =>
        ["open", "partially_fulfilled"].includes(row.status),
      );

      setSnapshot({
        balances: balances.data ?? [],
        demand: demand.data ?? [],
        procurement: procurement.data ?? [],
        assembly: openAssemblyRows,
        receipts: receipts.data ?? [],
        grns: grns.data ?? [],
      });
    } catch (err) {
      setSnapshot(EMPTY);
      setError(err instanceof Error ? err.message : "Failed to load the governed 3PGS command centre.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const metrics = useMemo(() => threePgsCommandCentreMetrics(snapshot), [snapshot]);
  const filteredBalances = useMemo(() => {
    const needle = skuFilter.trim().toLowerCase();
    return needle ? snapshot.balances.filter((row) => row.sku.toLowerCase().includes(needle)) : snapshot.balances;
  }, [snapshot.balances, skuFilter]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 pb-24">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Boxes className="h-6 w-6 text-primary" aria-hidden />
            <h1 className="text-xl font-bold tracking-tight">3PGS Command Centre</h1>
            <Badge variant="outline">R4.5 governed composition</Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            One read-only operational picture over Core stock, demand, procurement, P&amp;A handoff and inward/GRN truth.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline"><Link to="/admin/3pgs-procurement-queue">Open operator queue</Link></Button>
          <Button asChild size="sm" variant="outline"><Link to="/admin/inventory-receiving">Open receiving / GRN</Link></Button>
          <Button size="sm" variant="outline" onClick={() => { void load(); }} disabled={loading}>
            <RefreshCw className={`mr-1 h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden />Refresh
          </Button>
        </div>
      </header>

      {error ? (
        <Card className="border-destructive/40"><CardContent className="flex items-center gap-2 p-4 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4" aria-hidden />{error}
        </CardContent></Card>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <Metric icon={<Boxes className="h-4 w-4" />} label="Available" value={metrics.available} />
        <Metric icon={<PackageCheck className="h-4 w-4" />} label="Reserved" value={metrics.reserved} />
        <Metric icon={<AlertTriangle className="h-4 w-4" />} label="Exception qty" value={metrics.exceptions} />
        <Metric icon={<Truck className="h-4 w-4" />} label="Open procurement" value={metrics.openProcurement} />
        <Metric icon={<ClipboardList className="h-4 w-4" />} label="Open P&A demand" value={metrics.openAssembly} />
        <Metric icon={<PackageCheck className="h-4 w-4" />} label="Awaiting GRN" value={metrics.receiptsAwaitingGrn} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Priority demand</CardTitle><CardDescription className="text-xs">Canonical order: P&amp;A → Outlet → B2B → Internal.</CardDescription></CardHeader>
          <CardContent className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Rank</TableHead><TableHead>Source</TableHead><TableHead>SKU</TableHead><TableHead className="text-right">Outstanding</TableHead></TableRow></TableHeader><TableBody>
            {snapshot.demand.map((row) => <TableRow key={row.demand_id}><TableCell>{row.priority_rank}</TableCell><TableCell className="uppercase">{row.demand_source_type}</TableCell><TableCell>{row.sku}</TableCell><TableCell className="text-right">{fmt(row.outstanding_qty)}</TableCell></TableRow>)}
          </TableBody></Table></CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Stock position</CardTitle><CardDescription className="text-xs">No direct stock writes; buckets are read from inventory_stock_balances.</CardDescription></CardHeader>
          <CardContent>
            <Input className="mb-3 h-8 max-w-xs text-xs" placeholder="Filter SKU" value={skuFilter} onChange={(event) => { setSkuFilter(event.target.value); }} />
            <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>SKU</TableHead><TableHead>Location</TableHead><TableHead className="text-right">Available</TableHead><TableHead className="text-right">Reserved</TableHead><TableHead className="text-right">Quarantine</TableHead></TableRow></TableHeader><TableBody>
              {filteredBalances.map((row) => <TableRow key={row.id}><TableCell>{row.sku}</TableCell><TableCell>{row.location_code}</TableCell><TableCell className="text-right">{fmt(row.available_qty)}</TableCell><TableCell className="text-right">{fmt(row.reserved_qty)}</TableCell><TableCell className="text-right">{fmt(row.quarantine_qty)}</TableCell></TableRow>)}
            </TableBody></Table></div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Procurement requirements</CardTitle></CardHeader><CardContent className="space-y-2">
          {snapshot.procurement.map((row) => <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-xs"><span>{row.requirement_number} · {row.sku} · {fmt(row.fulfilled_qty)} / {fmt(row.shortage_qty)}</span><Badge variant="secondary">{row.status.replace(/_/g, " ")}</Badge></div>)}
          {!loading && snapshot.procurement.length === 0 ? <p className="text-sm text-muted-foreground">No procurement requirements.</p> : null}
        </CardContent></Card>

        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">P&amp;A requirements awaiting 3PGS</CardTitle></CardHeader><CardContent className="space-y-2">
          {snapshot.assembly.map((row) => <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-xs"><span>{row.requirement_number} · {row.sku} · {fmt(row.fulfilled_qty)} / {fmt(row.requested_qty)}</span><Badge variant="secondary">{row.status.replace(/_/g, " ")}</Badge></div>)}
          {!loading && snapshot.assembly.length === 0 ? <p className="text-sm text-muted-foreground">No open P&amp;A requirements.</p> : null}
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Inbound / GRN control</CardTitle><CardDescription className="text-xs">Recent 3PGS receipts with finalisation state derived from canonical GRNs.</CardDescription></CardHeader>
        <CardContent className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Receipt</TableHead><TableHead>Status</TableHead><TableHead>GRN</TableHead><TableHead>Finalised</TableHead></TableRow></TableHeader><TableBody>
          {snapshot.receipts.map((receipt) => {
            const grn = snapshot.grns.find((row) => row.receipt_id === receipt.id);
            const finalised = grn !== undefined && (grn.status === "finalised" || grn.finalised_at !== null);
            return <TableRow key={receipt.id}><TableCell>{receipt.receipt_number}</TableCell><TableCell><Badge variant="outline">{receipt.status.replace(/_/g, " ")}</Badge></TableCell><TableCell>{grn?.grn_number ?? "—"}</TableCell><TableCell>{finalised ? "Yes" : "No"}</TableCell></TableRow>;
          })}
        </TableBody></Table></CardContent>
      </Card>
    </div>
  );
}

function fmt(value: number) { return Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 3 }); }

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return <Card><CardContent className="flex items-center gap-2 p-4"><span className="text-primary">{icon}</span><div><p className="text-xl font-bold">{fmt(value)}</p><p className="text-[11px] text-muted-foreground">{label}</p></div></CardContent></Card>;
}
