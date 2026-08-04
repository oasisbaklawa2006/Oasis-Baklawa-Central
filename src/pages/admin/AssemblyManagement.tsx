import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  Clock3,
  PackageCheck,
  RefreshCw,
  Scale,
  ShieldCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// Temporary typed boundary for live Phase 2 relations pending regenerated
// project-wide Supabase definitions.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fulfilmentDb = supabase as unknown as { from: (relation: string) => any };

type AssemblyJob = {
  id: string;
  assembly_job_number: string;
  order_id: string;
  output_product_id: string;
  output_sku: string;
  planned_qty: number;
  completed_qty: number;
  accepted_qty: number;
  rejected_qty: number;
  status: string;
  correlation_id: string;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
};

type AssemblyComponent = {
  id: string;
  assembly_job_id: string;
  product_id: string;
  sku: string;
  source_store_code: string;
  required_qty: number;
  reserved_qty: number;
  issued_qty: number;
  consumed_qty: number;
  wasted_qty: number;
  returned_qty: number;
};

type Product = { id: string; name: string; image_url: string | null };
type QueueFilter = "active" | "exceptions" | "completed" | "all";

const terminalStatuses = new Set(["accepted", "rejected", "cancelled"]);
const riskStatuses = new Set(["rejected", "partially_accepted"]);

/** Live P&A evidence. Governed transitions and custody posting remain server-controlled. */
export default function AssemblyManagement() {
  const [jobs, setJobs] = useState<AssemblyJob[]>([]);
  const [components, setComponents] = useState<AssemblyComponent[]>([]);
  const [products, setProducts] = useState<Record<string, Product>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<QueueFilter>("active");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const jobResult = await fulfilmentDb
        .from("b2b_assembly_jobs")
        .select("id, assembly_job_number, order_id, output_product_id, output_sku, planned_qty, completed_qty, accepted_qty, rejected_qty, status, correlation_id, started_at, completed_at, created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      if (jobResult.error) throw jobResult.error;

      const nextJobs = (jobResult.data ?? []) as AssemblyJob[];
      const nextComponents = await loadComponentsForJobs(nextJobs.map((job) => job.id));
      const productIds = [...new Set([
        ...nextJobs.map((job) => job.output_product_id),
        ...nextComponents.map((component) => component.product_id),
      ].filter(Boolean))];
      const productResult = productIds.length
        ? await supabase.from("products").select("id, name, image_url").in("id", productIds)
        : { data: [], error: null };
      if (productResult.error) throw productResult.error;

      setJobs(nextJobs);
      setComponents(nextComponents);
      setProducts(Object.fromEntries(((productResult.data ?? []) as Product[]).map((product) => [product.id, product])));
      setSelectedId((current) => current && nextJobs.some((job) => job.id === current) ? current : nextJobs[0]?.id ?? null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unexpected P&A data error");
      setJobs([]);
      setComponents([]);
      setProducts({});
      setSelectedId(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const componentJobIdsWithRisk = useMemo(() => new Set(
    components.filter(hasMaterialRisk).map((component) => component.assembly_job_id),
  ), [components]);
  const exceptionJobIds = useMemo(() => new Set(jobs
    .filter((job) => riskStatuses.has(job.status) || Number(job.rejected_qty) > 0 || componentJobIdsWithRisk.has(job.id))
    .map((job) => job.id)), [componentJobIdsWithRisk, jobs]);

  const visibleJobs = jobs.filter((job) => {
    if (filter === "active") return !terminalStatuses.has(job.status);
    if (filter === "exceptions") return exceptionJobIds.has(job.id);
    if (filter === "completed") return job.status === "accepted";
    return true;
  });
  const selected = jobs.find((job) => job.id === selectedId) ?? null;
  const selectedComponents = components.filter((component) => component.assembly_job_id === selectedId);
  const activeCount = jobs.filter((job) => !terminalStatuses.has(job.status)).length;
  const materialReadyCount = jobs.filter((job) => {
    const rows = components.filter((component) => component.assembly_job_id === job.id);
    return rows.length > 0 && rows.every((component) => Number(component.reserved_qty) >= Number(component.required_qty));
  }).length;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 pb-24">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Packing & Assembly operations</h1>
          <p className="text-xs text-muted-foreground">Latest 100 order-linked jobs · source readiness · output reconciliation</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh
        </Button>
      </header>

      {error && <Card className="border-destructive/40"><CardContent className="flex items-center gap-2 p-4 text-sm text-destructive"><AlertTriangle className="h-4 w-4" />P&amp;A contract could not be read: {error}</CardContent></Card>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric icon={Clock3} label="Active jobs" value={activeCount} tone={activeCount ? "amber" : "olive"} />
        <Metric icon={Boxes} label="Materials reserved" value={materialReadyCount} tone="olive" />
        <Metric icon={AlertTriangle} label="Jobs with exceptions" value={exceptionJobIds.size} tone={exceptionJobIds.size ? "red" : "olive"} />
        <Metric icon={CheckCircle2} label="Accepted output" value={jobs.filter((job) => job.status === "accepted").length} tone="olive" />
      </div>

      <Card className="border-amber-200 bg-amber-50/40">
        <CardContent className="flex gap-3 p-4 text-sm">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
          <div><p className="font-semibold">Read-only operational evidence</p><p className="text-muted-foreground">Job creation, material issue/acceptance, QC decisions, output handover and job close require governed transactional workflows. This screen does not silently edit stock or order status.</p></div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[minmax(300px,0.8fr)_minmax(0,1.7fr)]">
        <Card>
          <CardHeader className="space-y-3">
            <CardTitle className="text-base">P&amp;A job queue</CardTitle>
            <div className="flex flex-wrap gap-2">
              {(["active", "exceptions", "completed", "all"] as const).map((value) => <Button key={value} size="sm" variant={filter === value ? "default" : "outline"} onClick={() => setFilter(value)} className="capitalize">{value}</Button>)}
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {visibleJobs.map((job) => {
              const output = products[job.output_product_id];
              const progress = percentage(job.completed_qty, job.planned_qty);
              return <button key={job.id} type="button" onClick={() => setSelectedId(job.id)} className={`w-full rounded-lg border p-3 text-left transition-colors ${selectedId === job.id ? "border-primary bg-primary/5" : "hover:bg-muted/40"}`}>
                <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate text-sm font-semibold">{output?.name ?? job.output_sku}</p><p className="mt-1 text-[11px] font-mono text-muted-foreground">{job.assembly_job_number} · SO#{shortRef(job.order_id)}</p></div><StatusBadge status={job.status} /></div>
                <Progress value={progress} className="mt-3 h-1.5" />
                <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground"><span>{formatQty(job.completed_qty)} / {formatQty(job.planned_qty)} completed</span>{exceptionJobIds.has(job.id) && <span className="font-semibold text-destructive">Exception</span>}</div>
              </button>;
            })}
            {!loading && !visibleJobs.length && <Empty text="No P&A jobs match this queue." />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><PackageCheck className="h-4 w-4 text-primary" />Job detail</CardTitle></CardHeader>
          <CardContent>
            {selected ? <div className="space-y-5">
              <div className="grid gap-3 rounded-lg border bg-muted/20 p-4 sm:grid-cols-2 lg:grid-cols-4">
                <Detail label="Job" value={selected.assembly_job_number} />
                <Detail label="Output" value={products[selected.output_product_id]?.name ?? selected.output_sku} />
                <Detail label="Customer order" value={`SO#${shortRef(selected.order_id)}`} />
                <Detail label="Correlation" value={selected.correlation_id} mono />
              </div>

              <section className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-semibold">Dual-source material readiness</h2><p className="text-[11px] text-muted-foreground">RGS = canonical Finished Goods store record</p></div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <SourceReadiness title="Food / production sources" sourceCodes={["FINISHED_GOODS", "B2B_RAW"]} components={selectedComponents} />
                  <SourceReadiness title="Packaging & assembly sources" sourceCodes={["3PGS", "PACKING_ASSEMBLY"]} components={selectedComponents} />
                </div>
              </section>

              <section className="space-y-3">
                <h2 className="text-sm font-semibold">Component reconciliation</h2>
                <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Component</TableHead><TableHead>Source</TableHead><TableHead className="text-right">Required</TableHead><TableHead className="text-right">Reserved</TableHead><TableHead className="text-right">Issued</TableHead><TableHead className="text-right">Consumed</TableHead><TableHead className="text-right">Waste / return</TableHead><TableHead>State</TableHead></TableRow></TableHeader><TableBody>{selectedComponents.map((component) => <TableRow key={component.id}><TableCell><p className="font-medium">{products[component.product_id]?.name ?? component.sku}</p><p className="text-[11px] text-muted-foreground">{component.sku}</p></TableCell><TableCell>{sourceLabel(component.source_store_code)}</TableCell><TableCell className="text-right">{formatQty(component.required_qty)}</TableCell><TableCell className="text-right">{formatQty(component.reserved_qty)}</TableCell><TableCell className="text-right">{formatQty(component.issued_qty)}</TableCell><TableCell className="text-right">{formatQty(component.consumed_qty)}</TableCell><TableCell className="text-right">{formatQty(Number(component.wasted_qty) + Number(component.returned_qty))}</TableCell><TableCell>{hasMaterialRisk(component) ? <Badge variant="destructive">Short</Badge> : <Badge variant="outline">Accounted</Badge>}</TableCell></TableRow>)}</TableBody></Table></div>
                {!selectedComponents.length && <Empty text="No component lines have been recorded for this job." />}
              </section>

              <section className="space-y-3">
                <h2 className="text-sm font-semibold">Output truth</h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Quantity label="Planned" value={selected.planned_qty} />
                  <Quantity label="Completed" value={selected.completed_qty} />
                  <Quantity label="Accepted" value={selected.accepted_qty} good />
                  <Quantity label="Rejected" value={selected.rejected_qty} risk={Number(selected.rejected_qty) > 0} />
                </div>
              </section>
            </div> : <Empty text="Select a P&A job to inspect its material and output evidence." />}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

async function loadComponentsForJobs(jobIds: string[]) {
  if (!jobIds.length) return [] as AssemblyComponent[];
  const rows: AssemblyComponent[] = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const result = await fulfilmentDb
      .from("b2b_assembly_components")
      .select("id, assembly_job_id, product_id, sku, source_store_code, required_qty, reserved_qty, issued_qty, consumed_qty, wasted_qty, returned_qty")
      .in("assembly_job_id", jobIds)
      .order("assembly_job_id", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (result.error) throw result.error;
    const page = (result.data ?? []) as AssemblyComponent[];
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

function hasMaterialRisk(component: AssemblyComponent) {
  const required = Number(component.required_qty);
  const reserved = Number(component.reserved_qty);
  const issued = Number(component.issued_qty);
  const accounted = Number(component.consumed_qty) + Number(component.wasted_qty) + Number(component.returned_qty);
  return reserved < required || issued > 0 && accounted < issued;
}
function sourceLabel(code: string) { return code === "FINISHED_GOODS" ? "RGS / Finished Goods" : code === "3PGS" ? "3PGS" : code.replace(/_/g, " "); }
function shortRef(value: string) { return value.slice(0, 8).toUpperCase(); }
function formatQty(value: number) { return Number(value).toLocaleString("en-IN", { maximumFractionDigits: 3 }); }
function percentage(value: number, total: number) { return Number(total) > 0 ? Math.min(100, Math.round(Number(value) / Number(total) * 100)) : 0; }
function StatusBadge({ status }: { status: string }) { return <Badge variant={status === "rejected" ? "destructive" : "outline"} className="shrink-0 text-[10px] uppercase">{status.replace(/_/g, " ")}</Badge>; }
function Detail({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) { return <div><p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p><p className={`mt-1 break-words text-sm font-semibold ${mono ? "font-mono text-xs" : ""}`}>{value}</p></div>; }
function Quantity({ label, value, good = false, risk = false }: { label: string; value: number; good?: boolean; risk?: boolean }) { return <div className={`rounded-lg border p-3 ${risk ? "border-destructive/30 bg-destructive/5" : good ? "border-emerald-200 bg-emerald-50/40" : "bg-muted/20"}`}><p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 text-lg font-bold">{formatQty(value)}</p></div>; }
function SourceReadiness({ title, sourceCodes, components }: { title: string; sourceCodes: string[]; components: AssemblyComponent[] }) { const rows = components.filter((component) => sourceCodes.includes(component.source_store_code)); const required = rows.reduce((sum, row) => sum + Number(row.required_qty), 0); const reserved = rows.reduce((sum, row) => sum + Number(row.reserved_qty), 0); const pct = percentage(reserved, required); return <div className="rounded-lg border p-4"><div className="flex items-center justify-between gap-2"><p className="text-sm font-semibold">{title}</p><Badge variant={required > 0 && reserved >= required ? "outline" : "secondary"}>{required === 0 ? "Not required" : reserved >= required ? "Reserved" : "Short"}</Badge></div><Progress value={pct} className="mt-3 h-2" /><div className="mt-2 flex items-center justify-between text-xs text-muted-foreground"><span>{rows.length} component{rows.length === 1 ? "" : "s"}</span><span>{formatQty(reserved)} / {formatQty(required)}</span></div></div>; }
function Metric({ icon: Icon, label, value, tone }: { icon: typeof Scale; label: string; value: number; tone: "olive" | "red" | "amber" }) { return <Card><CardContent className="flex items-center gap-3 p-4"><Icon className={`h-5 w-5 ${tone === "red" ? "text-destructive" : tone === "amber" ? "text-amber-600" : "text-primary"}`} /><div><p className="text-2xl font-bold">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div></CardContent></Card>; }
function Empty({ text }: { text: string }) { return <p className="py-10 text-center text-sm text-muted-foreground">{text}</p>; }
