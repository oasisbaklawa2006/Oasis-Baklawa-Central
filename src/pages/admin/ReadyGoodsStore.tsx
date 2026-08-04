import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Factory, PackageCheck, RefreshCw, ShieldCheck, Warehouse } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// Temporary typed boundary for live Phase 2 relations pending regenerated
// project-wide Supabase definitions.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const operationsDb = supabase as unknown as { from: (relation: string) => any };

type Availability = {
  product_id: string;
  sku: string;
  store_code: string;
  available_for_b2b_qty: number;
  reserved_qty: number;
  unavailable_qty: number;
  updated_at: string;
};
type Demand = {
  id: string;
  order_id: string;
  product_id: string | null;
  quantity: number;
  actual_packed_qty: number | null;
  production_status: string | null;
  department: string | null;
  order: { id: string; status: string; created_at: string | null; company: { business_name: string } | null } | null;
  product: { id: string; name: string; sku: string | null; production_department: string | null } | null;
};
type ProductionJob = {
  id: string;
  order_item_id: string | null;
  order_id: string | null;
  product_id: string | null;
  department: string;
  assigned_qty: number;
  produced_qty: number | null;
  batch_number: string | null;
  priority: string;
  stage: string;
  status: string;
  created_at: string | null;
};
type Transfer = {
  id: string;
  job_id: string;
  product_id: string | null;
  quantity: number;
  batch_number: string | null;
  rgs_notified: boolean | null;
  created_at: string | null;
};
type DemandState = Demand & {
  sku: string;
  requestedQty: number;
  availableQty: number;
  shortageQty: number;
  jobs: ProductionJob[];
};
type QueueFilter = "shortages" | "production" | "receipts" | "all";

const openJobStatuses = new Set(["pending", "accepted", "in_production", "paused"]);
const activeOrderStatuses = ["approved", "in_production", "manufacturing", "partial_ready"];

/** RGS is the business-facing alias of the canonical FINISHED_GOODS store. */
export default function ReadyGoodsStore() {
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [demand, setDemand] = useState<Demand[]>([]);
  const [jobs, setJobs] = useState<ProductionJob[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [filter, setFilter] = useState<QueueFilter>("shortages");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [availabilityResult, demandResult, jobsResult, transfersResult] = await Promise.all([
        operationsDb.from("b2b_order_availability")
          .select("product_id, sku, store_code, available_for_b2b_qty, reserved_qty, unavailable_qty, updated_at")
          .eq("store_code", "FINISHED_GOODS")
          .order("sku", { ascending: true }),
        operationsDb.from("order_items")
          .select("id, order_id, product_id, quantity, actual_packed_qty, production_status, department, order:orders!inner(id, status, created_at, company:companies(business_name)), product:products(id, name, sku, production_department)")
          .in("order.status", activeOrderStatuses)
          .order("orders(created_at)", { ascending: true })
          .limit(500),
        operationsDb.from("production_jobs")
          .select("id, order_item_id, order_id, product_id, department, assigned_qty, produced_qty, batch_number, priority, stage, status, created_at")
          .order("created_at", { ascending: false })
          .limit(500),
        operationsDb.from("production_rgs_transfers")
          .select("id, job_id, product_id, quantity, batch_number, rgs_notified, created_at")
          .order("created_at", { ascending: false })
          .limit(500),
      ]);
      const failed = availabilityResult.error ?? demandResult.error ?? jobsResult.error ?? transfersResult.error;
      if (failed) throw failed;
      const nextDemand = (demandResult.data ?? []) as Demand[];
      setAvailability((availabilityResult.data ?? []) as Availability[]);
      setDemand(nextDemand);
      setJobs((jobsResult.data ?? []) as ProductionJob[]);
      setTransfers((transfersResult.data ?? []) as Transfer[]);
      setSelectedId((current) => current && nextDemand.some((row) => row.id === current) ? current : nextDemand[0]?.id ?? null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unexpected RGS data error");
      setAvailability([]);
      setDemand([]);
      setJobs([]);
      setTransfers([]);
      setSelectedId(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const states = useMemo(() => {
    const availableByProduct = availability.reduce((totals, row) => {
      totals.set(row.product_id, (totals.get(row.product_id) ?? 0) + Number(row.available_for_b2b_qty));
      return totals;
    }, new Map<string, number>());
    const remainingByProduct = new Map(availableByProduct);
    return demand.map((row): DemandState => {
      const requestedQty = Math.max(Number(row.quantity) - Number(row.actual_packed_qty ?? 0), 0);
      const remaining = row.product_id ? remainingByProduct.get(row.product_id) ?? 0 : 0;
      const allocated = Math.min(remaining, requestedQty);
      if (row.product_id) remainingByProduct.set(row.product_id, Math.max(remaining - allocated, 0));
      const rowJobs = jobs.filter((job) =>
        job.order_item_id === row.id ||
        (job.product_id != null && row.product_id != null && job.order_id === row.order_id && job.product_id === row.product_id),
      );
      return {
        ...row,
        sku: row.product?.sku ?? "SKU not assigned",
        requestedQty,
        availableQty: allocated,
        shortageQty: Math.max(requestedQty - allocated, 0),
        jobs: rowJobs,
      };
    });
  }, [availability, demand, jobs]);

  const filtered = states.filter((row) => {
    if (filter === "shortages") return row.shortageQty > 0;
    if (filter === "production") return row.jobs.some((job) => openJobStatuses.has(job.status));
    if (filter === "receipts") return row.jobs.some((job) => transfers.some((transfer) => transfer.job_id === job.id));
    return true;
  });
  const selected = states.find((row) => row.id === selectedId) ?? null;
  const selectedTransfers = selected
    ? transfers.filter((transfer) => selected.jobs.some((job) => job.id === transfer.job_id))
    : [];
  const shortageCount = states.filter((row) => row.shortageQty > 0).length;
  const openProductionCount = jobs.filter((job) => openJobStatuses.has(job.status)).length;
  const pendingAcceptanceCount = transfers.filter((row) => !row.rgs_notified).length;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 pb-24">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Ready Goods Store (RGS)</h1>
          <p className="text-xs text-muted-foreground">Demand matching · shortage routing · Production-to-RGS evidence</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh
        </Button>
      </header>

      {error && <Card className="border-destructive/40"><CardContent className="flex items-center gap-2 p-4 text-sm text-destructive"><AlertTriangle className="h-4 w-4" />RGS contracts could not be read: {error}</CardContent></Card>}

      <div className="grid gap-3 sm:grid-cols-3">
        <Metric icon={AlertTriangle} label="Demand shortages" value={shortageCount} risk={shortageCount > 0} />
        <Metric icon={Factory} label="Open production jobs" value={openProductionCount} />
        <Metric icon={PackageCheck} label="Transfers awaiting acknowledgement" value={pendingAcceptanceCount} risk={pendingAcceptanceCount > 0} />
      </div>

      <Card className="border-amber-200 bg-amber-50/40">
        <CardContent className="flex gap-3 p-4 text-sm">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
          <div><p className="font-semibold">Read-only custody evidence</p><p className="text-muted-foreground">RGS maps to the canonical FINISHED_GOODS store. Production requests, stock allocation, receipt acceptance and custody posting remain disabled until governed transactional workflows are available.</p></div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[minmax(320px,0.9fr)_minmax(0,1.6fr)]">
        <Card>
          <CardHeader className="space-y-3">
            <CardTitle className="text-base">RGS demand queue</CardTitle>
            <div className="flex flex-wrap gap-2">{(["shortages", "production", "receipts", "all"] as const).map((value) => <Button key={value} size="sm" variant={filter === value ? "default" : "outline"} aria-pressed={filter === value} onClick={() => setFilter(value)} className="capitalize">{value}</Button>)}</div>
          </CardHeader>
          <CardContent className="space-y-2">
            {filtered.map((row) => <button key={row.id} type="button" onClick={() => setSelectedId(row.id)} className={`w-full rounded-lg border p-3 text-left transition-colors ${selectedId === row.id ? "border-primary bg-primary/5" : "hover:bg-muted/40"}`}>
              <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate text-sm font-semibold">{row.product?.name ?? row.sku}</p><p className="mt-1 text-[11px] text-muted-foreground">SO#{shortRef(row.order_id)} · {row.order?.company?.business_name ?? "Customer"}</p></div><Badge variant={row.shortageQty > 0 ? "destructive" : "outline"}>{row.shortageQty > 0 ? `${formatQty(row.shortageQty)} short` : "Available"}</Badge></div>
              <p className="mt-2 text-[11px] text-muted-foreground">{formatQty(row.availableQty)} available for {formatQty(row.requestedQty)} required · {row.jobs.length} linked production job{row.jobs.length === 1 ? "" : "s"}</p>
            </button>)}
            {!loading && !filtered.length && <Empty text="No RGS demand matches this queue." />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Warehouse className="h-4 w-4 text-primary" />Demand and custody detail</CardTitle></CardHeader>
          <CardContent>
            {selected ? <div className="space-y-5">
              <div className="grid gap-3 rounded-lg border bg-muted/20 p-4 sm:grid-cols-2 lg:grid-cols-4">
                <Detail label="Customer order" value={`SO#${shortRef(selected.order_id)}`} />
                <Detail label="SKU" value={selected.sku} />
                <Detail label="Required" value={formatQty(selected.requestedQty)} />
                <Detail label="RGS allocation" value={formatQty(selected.availableQty)} />
              </div>

              <section className="space-y-3">
                <h2 className="text-sm font-semibold">Shortage routing and production correlation</h2>
                <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Job</TableHead><TableHead>Department</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Assigned</TableHead><TableHead className="text-right">Produced</TableHead><TableHead>Batch</TableHead></TableRow></TableHeader><TableBody>{selected.jobs.map((job) => <TableRow key={job.id}><TableCell className="font-mono text-xs">{shortRef(job.id)}</TableCell><TableCell>{job.department}</TableCell><TableCell><StatusBadge status={job.status} /></TableCell><TableCell className="text-right">{formatQty(job.assigned_qty)}</TableCell><TableCell className="text-right">{formatQty(job.produced_qty ?? 0)}</TableCell><TableCell>{job.batch_number ?? "Pending"}</TableCell></TableRow>)}</TableBody></Table></div>
                {!selected.jobs.length && <Empty text={selected.shortageQty > 0 ? "Shortage identified; no governed production job is linked yet." : "No production job is required for this demand."} />}
              </section>

              <section className="space-y-3">
                <h2 className="text-sm font-semibold">Production-to-RGS receipt evidence</h2>
                <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Transfer</TableHead><TableHead>Production job</TableHead><TableHead className="text-right">Quantity</TableHead><TableHead>Batch</TableHead><TableHead>RGS acknowledgement</TableHead></TableRow></TableHeader><TableBody>{selectedTransfers.map((transfer) => <TableRow key={transfer.id}><TableCell className="font-mono text-xs">{shortRef(transfer.id)}</TableCell><TableCell className="font-mono text-xs">{shortRef(transfer.job_id)}</TableCell><TableCell className="text-right">{formatQty(transfer.quantity)}</TableCell><TableCell>{transfer.batch_number ?? "Not recorded"}</TableCell><TableCell>{transfer.rgs_notified ? <Badge variant="outline">Notified</Badge> : <Badge variant="secondary">Pending evidence</Badge>}</TableCell></TableRow>)}</TableBody></Table></div>
                {!selectedTransfers.length && <Empty text="No Production-to-RGS transfer evidence is linked to this demand." />}
              </section>
            </div> : <Empty text="Select an RGS demand line to inspect its availability and production evidence." />}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function shortRef(value: string) { return value.slice(0, 8).toUpperCase(); }
function formatQty(value: number) { return Number(value).toLocaleString("en-IN", { maximumFractionDigits: 3 }); }
function StatusBadge({ status }: { status: string }) { return <Badge variant={status === "rejected" ? "destructive" : "outline"} className="text-[10px] uppercase">{status.replace(/_/g, " ")}</Badge>; }
function Detail({ label, value }: { label: string; value: string }) { return <div><p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 text-sm font-semibold">{value}</p></div>; }
function Metric({ icon: Icon, label, value, risk = false }: { icon: typeof Warehouse; label: string; value: number; risk?: boolean }) { return <Card><CardContent className="flex items-center gap-3 p-4"><Icon className={`h-5 w-5 ${risk ? "text-destructive" : "text-primary"}`} /><div><p className="text-2xl font-bold">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div></CardContent></Card>; }
function Empty({ text }: { text: string }) { return <p className="py-8 text-center text-sm text-muted-foreground">{text}</p>; }
