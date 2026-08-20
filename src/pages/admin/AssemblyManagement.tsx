import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  Clock3,
  PackageCheck,
  PackagePlus,
  RefreshCw,
  Scale,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { pnaAssemblyRpc } from "@/lib/pnaAssemblyRpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

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
  handed_over_at: string | null;
  job_completed_at: string | null;
  job_closed_at: string | null;
  partial_issue_authorized: boolean;
  reconciliation_variance_qty: number | null;
  output_level: string;
  job_purpose: string | null;
  bom_version: string | null;
  master_data_version: string | null;
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

type AssemblyHandover = {
  id: string;
  assembly_job_id: string;
  destination_type: string;
  destination_reference: string;
  dispatched_qty: number;
  carton_count: number | null;
  dispatched_at: string;
  receiver_id: string | null;
  received_qty: number | null;
  acknowledged_at: string | null;
  status: string;
};

type Assembly3pgsRequirement = {
  id: string;
  assembly_component_id: string;
  product_id: string;
  sku: string;
  source_store_code: string;
  requested_qty: number;
  fulfilled_qty: number;
  status: string;
};

type Product = { id: string; name: string; image_url: string | null };
type OrderLookup = { id: string; order_number: string };
type OrderLine = { id: string; product_id: string; quantity: number; product_name: string; sku: string };
type QueueFilter = "active" | "exceptions" | "completed" | "all";

// Job Closed is the only terminal state now -- Ready/Handed Over/Job
// Completed all still need action (handover, reconciliation, close).
const terminalStatuses = new Set(["job_closed", "cancelled"]);
const riskStatuses = new Set(["rejected", "partially_accepted", "partially_reserved"]);
const destinationTypes = ["RGS", "3PGS", "OUTLET", "INTERNAL", "CUSTOMER_DIRECT"] as const;

/** Live P&A evidence and governed lifecycle actions. Every transition below calls a governed Core RPC; this screen never writes stock or job rows directly. */
export default function AssemblyManagement() {
  const [jobs, setJobs] = useState<AssemblyJob[]>([]);
  const [components, setComponents] = useState<AssemblyComponent[]>([]);
  const [products, setProducts] = useState<Record<string, Product>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<QueueFilter>("active");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);
  const [completedQtyDraft, setCompletedQtyDraft] = useState("");
  const [acceptDraft, setAcceptDraft] = useState({ accepted: "", rejected: "" });
  const [consumptionDraft, setConsumptionDraft] = useState<Record<string, { consumed: string; wasted: string; returned: string }>>({});
  const [partialReasonDraft, setPartialReasonDraft] = useState("");
  const [handoverDraft, setHandoverDraft] = useState({ destinationType: "RGS" as string, destinationReference: "", qty: "", cartons: "", evidence: "" });
  const [ackDraft, setAckDraft] = useState<Record<string, { qty: string; evidence: string }>>({});
  const [reconcileDraft, setReconcileDraft] = useState({ notes: "" });
  const [computedVariance, setComputedVariance] = useState<number | null>(null);

  const [handovers, setHandovers] = useState<AssemblyHandover[]>([]);
  const [requirements, setRequirements] = useState<Assembly3pgsRequirement[]>([]);

  // Create-job-from-requirement panel (Level 0 decomposition off product_bom,
  // source store resolved off b2b_inventory_item_profiles -- a real requirement
  // -> job creation path, not a UI-seeded fixture).
  const [orderNumberDraft, setOrderNumberDraft] = useState("");
  const [orderLookup, setOrderLookup] = useState<OrderLookup | null>(null);
  const [orderLines, setOrderLines] = useState<OrderLine[]>([]);
  const [createLookupError, setCreateLookupError] = useState<string | null>(null);
  const [createOutputProductId, setCreateOutputProductId] = useState("");
  const [createPlannedQty, setCreatePlannedQty] = useState("");
  const [createOutputLevel, setCreateOutputLevel] = useState<"1A" | "1B" | "2">("2");
  const [createJobPurpose, setCreateJobPurpose] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const jobResult = await fulfilmentDb
        .from("b2b_assembly_jobs")
        .select("id, assembly_job_number, order_id, output_product_id, output_sku, planned_qty, completed_qty, accepted_qty, rejected_qty, status, correlation_id, started_at, completed_at, handed_over_at, job_completed_at, job_closed_at, partial_issue_authorized, reconciliation_variance_qty, output_level, job_purpose, bom_version, master_data_version, created_at")
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

  // Handovers/3PGS requirements are per-job evidence, loaded on selection and
  // refreshed after any action so a receiver-acknowledged handover or a
  // fulfilled 3PGS requirement shows up without a full reload.
  useEffect(() => {
    if (!selectedId) { setHandovers([]); setRequirements([]); return; }
    let cancelled = false;
    (async () => {
      const [handoverResult, requirementResult] = await Promise.all([
        fulfilmentDb.from("b2b_assembly_handovers")
          .select("id, assembly_job_id, destination_type, destination_reference, dispatched_qty, carton_count, dispatched_at, receiver_id, received_qty, acknowledged_at, status")
          .eq("assembly_job_id", selectedId)
          .order("dispatched_at", { ascending: false }),
        fulfilmentDb.from("b2b_assembly_3pgs_requirements")
          .select("id, assembly_component_id, product_id, sku, source_store_code, requested_qty, fulfilled_qty, status")
          .eq("assembly_job_id", selectedId),
      ]);
      if (cancelled) return;
      setHandovers((handoverResult.data ?? []) as AssemblyHandover[]);
      setRequirements((requirementResult.data ?? []) as Assembly3pgsRequirement[]);
    })();
    return () => { cancelled = true; };
  }, [selectedId, acting]);

  // Reconciliation variance is NEVER something this screen lets a user type
  // in and submit -- it is always fetched fresh from the server's own
  // compute_assembly_job_variance (the same computation reconcile_assembly_job
  // uses internally), purely for display before reconciling.
  useEffect(() => {
    const job = jobs.find((candidate) => candidate.id === selectedId);
    if (!job || job.status !== "reconciliation_pending") { setComputedVariance(null); return; }
    let cancelled = false;
    (async () => {
      const result = await pnaAssemblyRpc.rpc("compute_assembly_job_variance", { p_assembly_job_id: job.id });
      if (cancelled) return;
      setComputedVariance(result.error ? null : Number(result.data));
    })();
    return () => { cancelled = true; };
  }, [selectedId, acting, jobs]);

  const runAction = useCallback(async (label: string, fn: string, args: Record<string, unknown>) => {
    setActing(true);
    try {
      const { error: rpcError } = await pnaAssemblyRpc.rpc(fn, args);
      if (rpcError) { toast.error(rpcError.message || `${label} failed`); return; }
      toast.success(label);
      await load();
    } finally {
      setActing(false);
    }
  }, [load]);

  const handleReserve = useCallback((jobId: string) => runAction(
    "Components reserved", "reserve_assembly_components",
    { p_assembly_job_id: jobId, p_priority: "normal", p_correlation_id: crypto.randomUUID() },
  ), [runAction]);

  const handleAuthorizePartialIssue = useCallback((jobId: string) => {
    if (!partialReasonDraft.trim()) { toast.error("A reason is required to authorise a partial issue"); return Promise.resolve(); }
    return runAction(
      "Partial issue authorised", "authorize_partial_assembly_issue",
      { p_assembly_job_id: jobId, p_reason: partialReasonDraft.trim(), p_correlation_id: crypto.randomUUID() },
    );
  }, [partialReasonDraft, runAction]);

  const handleIssue = useCallback((jobId: string) => runAction(
    "Components issued", "issue_assembly_components",
    { p_assembly_job_id: jobId, p_correlation_id: crypto.randomUUID() },
  ), [runAction]);

  const handleConsumption = useCallback((componentId: string) => {
    const draft = consumptionDraft[componentId] ?? { consumed: "", wasted: "", returned: "" };
    return runAction(
      "Consumption recorded", "record_assembly_consumption",
      {
        p_component_id: componentId,
        p_consumed_qty: Number(draft.consumed || 0),
        p_wasted_qty: Number(draft.wasted || 0),
        p_returned_qty: Number(draft.returned || 0),
        p_correlation_id: crypto.randomUUID(),
      },
    );
  }, [consumptionDraft, runAction]);

  const handleComplete = useCallback((jobId: string) => runAction(
    "Sent to QC", "complete_assembly_job",
    { p_assembly_job_id: jobId, p_completed_qty: Number(completedQtyDraft || 0), p_correlation_id: crypto.randomUUID() },
  ), [completedQtyDraft, runAction]);

  const handleAccept = useCallback((jobId: string) => runAction(
    "QC decision recorded", "accept_assembly_output",
    {
      p_assembly_job_id: jobId,
      p_accepted_qty: Number(acceptDraft.accepted || 0),
      p_rejected_qty: Number(acceptDraft.rejected || 0),
      p_correlation_id: crypto.randomUUID(),
    },
  ), [acceptDraft, runAction]);

  const handleInitiateHandover = useCallback((jobId: string) => {
    if (!handoverDraft.destinationReference.trim()) { toast.error("A destination reference is required"); return Promise.resolve(); }
    return runAction(
      "Handover dispatched", "initiate_assembly_handover",
      {
        p_assembly_job_id: jobId,
        p_destination_type: handoverDraft.destinationType,
        p_destination_reference: handoverDraft.destinationReference.trim(),
        p_dispatched_qty: Number(handoverDraft.qty || 0),
        p_carton_count: handoverDraft.cartons ? Number(handoverDraft.cartons) : null,
        p_evidence_reference: handoverDraft.evidence || null,
        p_correlation_id: crypto.randomUUID(),
      },
    );
  }, [handoverDraft, runAction]);

  const handleAcknowledgeHandover = useCallback((handoverId: string, defaultQty: number) => {
    const draft = ackDraft[handoverId] ?? { qty: String(defaultQty), evidence: "" };
    return runAction(
      "Handover acknowledged by receiver", "acknowledge_assembly_handover",
      {
        p_handover_id: handoverId,
        p_received_qty: Number(draft.qty || 0),
        p_evidence_reference: draft.evidence || null,
        p_correlation_id: crypto.randomUUID(),
      },
    );
  }, [ackDraft, runAction]);

  const handleReconcile = useCallback((jobId: string) => {
    // The variance itself is never sent -- reconcile_assembly_job derives it
    // server-side. computedVariance here is only what was just fetched for
    // display, used client-side purely to prompt for notes before the round
    // trip; the RPC re-derives and enforces the real gate regardless.
    if (computedVariance !== null && computedVariance !== 0 && !reconcileDraft.notes.trim()) {
      toast.error(`A non-zero reconciliation variance (${computedVariance}) requires explanatory notes`);
      return Promise.resolve();
    }
    return runAction(
      "Job reconciled (Job Completed)", "reconcile_assembly_job",
      { p_assembly_job_id: jobId, p_notes: reconcileDraft.notes || null, p_correlation_id: crypto.randomUUID() },
    );
  }, [computedVariance, reconcileDraft, runAction]);

  const handleClose = useCallback((jobId: string) => runAction(
    "Job closed", "close_assembly_job",
    { p_assembly_job_id: jobId, p_correlation_id: crypto.randomUUID() },
  ), [runAction]);

  const handleLookupOrder = useCallback(async () => {
    setCreateLookupError(null);
    setOrderLookup(null);
    setOrderLines([]);
    setCreateOutputProductId("");
    const trimmed = orderNumberDraft.trim();
    if (!trimmed) return;
    const orderResult = await supabase.from("orders").select("id, order_number").eq("order_number", trimmed).maybeSingle();
    if (orderResult.error || !orderResult.data) { setCreateLookupError("Order not found for that order number"); return; }
    const itemsResult = await supabase.from("order_items").select("id, product_id, quantity, products(name, sku)").eq("order_id", orderResult.data.id);
    if (itemsResult.error) { setCreateLookupError(itemsResult.error.message); return; }
    setOrderLookup(orderResult.data as OrderLookup);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setOrderLines(((itemsResult.data ?? []) as any[]).map((row) => ({
      id: row.id, product_id: row.product_id, quantity: Number(row.quantity),
      product_name: row.products?.name ?? row.product_id, sku: row.products?.sku ?? "",
    })));
  }, [orderNumberDraft]);

  const handleCreateJob = useCallback(async () => {
    if (!orderLookup || !createOutputProductId) return;
    const plannedQty = Number(createPlannedQty || 0);
    if (plannedQty <= 0) { toast.error("Planned quantity must be positive"); return; }
    if (createOutputLevel === "1B" && createJobPurpose.trim() !== "hamper") {
      toast.error("Level 1B output must have job purpose 'hamper'");
      return;
    }
    setCreating(true);
    try {
      // Level 0 decomposition: this job's component INPUTS come from the
      // output product's approved BOM, never invented client-side.
      const bomResult = await fulfilmentDb
        .from("product_bom")
        .select("component_product_id, component_name, quantity_per_unit, created_at")
        .eq("product_id", createOutputProductId);
      if (bomResult.error) { toast.error(bomResult.error.message); return; }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const bomRows = (bomResult.data ?? []) as any[];
      const resolvedRows = bomRows.filter((row) => row.component_product_id);
      if (!resolvedRows.length) {
        toast.error("This product has no resolvable BOM (Level 0 decomposition); cannot create an assembly job for it");
        return;
      }

      const componentIds = [...new Set(resolvedRows.map((row) => row.component_product_id as string))];
      const profileResult = await fulfilmentDb
        .from("b2b_inventory_item_profiles")
        .select("product_id, sku, primary_store_code")
        .in("product_id", componentIds);
      if (profileResult.error) { toast.error(profileResult.error.message); return; }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const profileByProduct = new Map<string, any>((profileResult.data ?? []).map((row: any) => [row.product_id, row]));
      const missing = componentIds.filter((id) => !profileByProduct.has(id));
      if (missing.length) {
        toast.error(`No governed store profile for ${missing.length} BOM component(s); refusing to guess a source store`);
        return;
      }

      const components = resolvedRows.map((row) => {
        const profile = profileByProduct.get(row.component_product_id as string);
        return {
          product_id: row.component_product_id,
          sku: profile.sku,
          source_store_code: profile.primary_store_code,
          required_qty: Number(row.quantity_per_unit) * plannedQty,
        };
      });
      const bomVersion = `product_bom@${resolvedRows.reduce((latest: string, row) => (row.created_at > latest ? row.created_at : latest), resolvedRows[0].created_at as string)}`;
      const output = orderLines.find((line) => line.product_id === createOutputProductId);

      const { error: rpcError } = await pnaAssemblyRpc.rpc("create_assembly_job", {
        p_assembly_job_number: `ASM-${orderLookup.order_number}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
        p_order_id: orderLookup.id,
        p_output_product_id: createOutputProductId,
        p_output_sku: output?.sku ?? "",
        p_planned_qty: plannedQty,
        p_components: components,
        p_correlation_id: crypto.randomUUID(),
        p_output_level: createOutputLevel,
        p_job_purpose: createJobPurpose.trim() || null,
        p_bom_version: bomVersion,
        // AI Studio's approved master/photo-version surface is not yet
        // exposed to Central; leave unset here rather than fabricate one.
        p_master_data_version: null,
      });
      if (rpcError) { toast.error(rpcError.message || "Failed to create assembly job"); return; }

      toast.success("Assembly job created from the order's Level 0 requirement");
      setOrderNumberDraft("");
      setOrderLookup(null);
      setOrderLines([]);
      setCreateOutputProductId("");
      setCreatePlannedQty("");
      setCreateJobPurpose("");
      await load();
    } finally {
      setCreating(false);
    }
  }, [orderLookup, createOutputProductId, createPlannedQty, createOutputLevel, createJobPurpose, orderLines, load]);

  const componentJobIdsWithRisk = useMemo(() => new Set(
    components.filter(hasMaterialRisk).map((component) => component.assembly_job_id),
  ), [components]);
  const exceptionJobIds = useMemo(() => new Set(jobs
    .filter((job) => riskStatuses.has(job.status) || Number(job.rejected_qty) > 0 || componentJobIdsWithRisk.has(job.id))
    .map((job) => job.id)), [componentJobIdsWithRisk, jobs]);

  const visibleJobs = jobs.filter((job) => {
    if (filter === "active") return !terminalStatuses.has(job.status);
    if (filter === "exceptions") return exceptionJobIds.has(job.id);
    if (filter === "completed") return job.status === "job_closed";
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
        <Metric icon={CheckCircle2} label="Jobs closed" value={jobs.filter((job) => job.status === "job_closed").length} tone="olive" />
      </div>

      <Card className="border-amber-200 bg-amber-50/40">
        <CardContent className="flex gap-3 p-4 text-sm">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
          <div><p className="font-semibold">Governed lifecycle actions only</p><p className="text-muted-foreground">Every action below calls a governed Core RPC (correlation-id idempotent, role-checked, forward-only transitions). This screen never writes stock or job rows directly.</p></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><PackagePlus className="h-4 w-4 text-primary" />Create assembly job from an order requirement</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1"><p className="text-[11px] uppercase text-muted-foreground">Order number</p><Input className="h-8 w-40" placeholder="SO-..." value={orderNumberDraft} onChange={(e) => setOrderNumberDraft(e.target.value)} /></div>
            <Button size="sm" variant="outline" onClick={() => void handleLookupOrder()}>Look up order</Button>
            {createLookupError && <p className="text-xs text-destructive">{createLookupError}</p>}
          </div>
          {orderLookup && <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
            <p className="text-xs text-muted-foreground">Order {orderLookup.order_number} · {orderLines.length} line{orderLines.length === 1 ? "" : "s"}</p>
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1">
                <p className="text-[11px] uppercase text-muted-foreground">Output product</p>
                <Select value={createOutputProductId} onValueChange={setCreateOutputProductId}>
                  <SelectTrigger className="h-8 w-56"><SelectValue placeholder="Select order line" /></SelectTrigger>
                  <SelectContent>{orderLines.map((line) => <SelectItem key={line.id} value={line.product_id}>{line.product_name} ({line.sku})</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><p className="text-[11px] uppercase text-muted-foreground">Planned qty</p><Input className="h-8 w-24" value={createPlannedQty} onChange={(e) => setCreatePlannedQty(e.target.value)} /></div>
              <div className="space-y-1">
                <p className="text-[11px] uppercase text-muted-foreground">Output level</p>
                <Select value={createOutputLevel} onValueChange={(value) => setCreateOutputLevel(value as "1A" | "1B" | "2")}>
                  <SelectTrigger className="h-8 w-24"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="1A">1A</SelectItem><SelectItem value="1B">1B (hamper)</SelectItem><SelectItem value="2">2</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><p className="text-[11px] uppercase text-muted-foreground">Job purpose</p><Input className="h-8 w-32" placeholder={createOutputLevel === "1B" ? "hamper" : "e.g. retail_pack"} value={createJobPurpose} onChange={(e) => setCreateJobPurpose(e.target.value)} /></div>
              <Button size="sm" disabled={creating || !createOutputProductId} onClick={() => void handleCreateJob()}>Create job (decompose BOM to Level 0)</Button>
            </div>
          </div>}
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
                <Detail label="Output level" value={`${selected.output_level}${selected.job_purpose ? ` · ${selected.job_purpose}` : ""}`} />
                <Detail label="BOM version" value={selected.bom_version ?? "—"} mono />
                <Detail label="Master-data version" value={selected.master_data_version ?? "not yet supplied by AI Studio"} mono />
              </div>

              <LifecycleActions
                job={selected}
                handovers={handovers}
                acting={acting}
                completedQtyDraft={completedQtyDraft}
                setCompletedQtyDraft={setCompletedQtyDraft}
                acceptDraft={acceptDraft}
                setAcceptDraft={setAcceptDraft}
                partialReasonDraft={partialReasonDraft}
                setPartialReasonDraft={setPartialReasonDraft}
                handoverDraft={handoverDraft}
                setHandoverDraft={setHandoverDraft}
                ackDraft={ackDraft}
                setAckDraft={setAckDraft}
                reconcileDraft={reconcileDraft}
                setReconcileDraft={setReconcileDraft}
                computedVariance={computedVariance}
                onReserve={() => handleReserve(selected.id)}
                onAuthorizePartialIssue={() => handleAuthorizePartialIssue(selected.id)}
                onIssue={() => handleIssue(selected.id)}
                onComplete={() => handleComplete(selected.id)}
                onAccept={() => handleAccept(selected.id)}
                onInitiateHandover={() => handleInitiateHandover(selected.id)}
                onAcknowledgeHandover={handleAcknowledgeHandover}
                onReconcile={() => handleReconcile(selected.id)}
                onClose={() => handleClose(selected.id)}
              />

              <section className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-semibold">Dual-source material readiness</h2><p className="text-[11px] text-muted-foreground">RGS = canonical Finished Goods store record</p></div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <SourceReadiness title="Food / production sources" sourceCodes={["FINISHED_GOODS", "B2B_RAW"]} components={selectedComponents} />
                  <SourceReadiness title="Packaging & assembly sources" sourceCodes={["3PGS", "PACKING_ASSEMBLY"]} components={selectedComponents} />
                </div>
              </section>

              {requirements.length > 0 && <section className="space-y-2">
                <h2 className="text-sm font-semibold">Governed 3PGS requirements (packaging/outsourced/giftware shortfalls)</h2>
                <div className="space-y-2">{requirements.map((requirement) => <div key={requirement.id} className="flex items-center justify-between rounded-lg border p-3 text-xs">
                  <span>{requirement.sku} · {requirement.source_store_code} · {formatQty(requirement.fulfilled_qty)} / {formatQty(requirement.requested_qty)}</span>
                  <Badge variant={requirement.status === "fulfilled" ? "outline" : "secondary"} className="uppercase">{requirement.status.replace(/_/g, " ")}</Badge>
                </div>)}</div>
              </section>}

              <section className="space-y-3">
                <h2 className="text-sm font-semibold">Component reconciliation (Level 0 inputs)</h2>
                <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Component</TableHead><TableHead>Source</TableHead><TableHead className="text-right">Required</TableHead><TableHead className="text-right">Reserved</TableHead><TableHead className="text-right">Issued</TableHead><TableHead className="text-right">Consumed</TableHead><TableHead className="text-right">Waste / return</TableHead><TableHead>State</TableHead>{(selected.status === "issued" || selected.status === "in_progress") && <TableHead>Log consumption</TableHead>}</TableRow></TableHeader><TableBody>{selectedComponents.map((component) => {
                  const draft = consumptionDraft[component.id] ?? { consumed: "", wasted: "", returned: "" };
                  const setDraft = (patch: Partial<typeof draft>) => setConsumptionDraft((current) => ({ ...current, [component.id]: { ...draft, ...patch } }));
                  return <TableRow key={component.id}><TableCell><p className="font-medium">{products[component.product_id]?.name ?? component.sku}</p><p className="text-[11px] text-muted-foreground">{component.sku}</p></TableCell><TableCell>{sourceLabel(component.source_store_code)}</TableCell><TableCell className="text-right">{formatQty(component.required_qty)}</TableCell><TableCell className="text-right">{formatQty(component.reserved_qty)}</TableCell><TableCell className="text-right">{formatQty(component.issued_qty)}</TableCell><TableCell className="text-right">{formatQty(component.consumed_qty)}</TableCell><TableCell className="text-right">{formatQty(Number(component.wasted_qty) + Number(component.returned_qty))}</TableCell><TableCell>{hasMaterialRisk(component) ? <Badge variant="destructive">Short</Badge> : <Badge variant="outline">Accounted</Badge>}</TableCell>
                    {(selected.status === "issued" || selected.status === "in_progress") && <TableCell>
                      <div className="flex items-center gap-1">
                        <Input className="h-7 w-16 text-xs" placeholder="Used" value={draft.consumed} onChange={(e) => setDraft({ consumed: e.target.value })} />
                        <Input className="h-7 w-16 text-xs" placeholder="Waste" value={draft.wasted} onChange={(e) => setDraft({ wasted: e.target.value })} />
                        <Input className="h-7 w-16 text-xs" placeholder="Return" value={draft.returned} onChange={(e) => setDraft({ returned: e.target.value })} />
                        <Button size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={acting} onClick={() => void handleConsumption(component.id)}>Log</Button>
                      </div>
                    </TableCell>}
                  </TableRow>;
                })}</TableBody></Table></div>
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
                {selected.reconciliation_variance_qty !== null && <p className="text-xs text-muted-foreground">Reconciliation variance: {formatQty(selected.reconciliation_variance_qty)}</p>}
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

type LifecycleActionsProps = {
  job: AssemblyJob;
  handovers: AssemblyHandover[];
  acting: boolean;
  completedQtyDraft: string;
  setCompletedQtyDraft: (value: string) => void;
  acceptDraft: { accepted: string; rejected: string };
  setAcceptDraft: (value: { accepted: string; rejected: string }) => void;
  partialReasonDraft: string;
  setPartialReasonDraft: (value: string) => void;
  handoverDraft: { destinationType: string; destinationReference: string; qty: string; cartons: string; evidence: string };
  setHandoverDraft: (value: { destinationType: string; destinationReference: string; qty: string; cartons: string; evidence: string }) => void;
  ackDraft: Record<string, { qty: string; evidence: string }>;
  setAckDraft: (value: Record<string, { qty: string; evidence: string }>) => void;
  reconcileDraft: { notes: string };
  setReconcileDraft: (value: { notes: string }) => void;
  computedVariance: number | null;
  onReserve: () => void;
  onAuthorizePartialIssue: () => void;
  onIssue: () => void;
  onComplete: () => void;
  onAccept: () => void;
  onInitiateHandover: () => void;
  onAcknowledgeHandover: (handoverId: string, defaultQty: number) => void;
  onReconcile: () => void;
  onClose: () => void;
};

function LifecycleActions({
  job, handovers, acting, completedQtyDraft, setCompletedQtyDraft, acceptDraft, setAcceptDraft,
  partialReasonDraft, setPartialReasonDraft, handoverDraft, setHandoverDraft, ackDraft, setAckDraft,
  reconcileDraft, setReconcileDraft, computedVariance,
  onReserve, onAuthorizePartialIssue, onIssue, onComplete, onAccept, onInitiateHandover, onAcknowledgeHandover, onReconcile, onClose,
}: LifecycleActionsProps) {
  if (job.status === "planned") {
    return <ActionBar><Button size="sm" disabled={acting} onClick={onReserve}>Reserve components</Button></ActionBar>;
  }
  if (job.status === "partially_reserved") {
    return <ActionBar>
      <Button size="sm" variant="outline" disabled={acting} onClick={onReserve}>Retry reservation</Button>
      {!job.partial_issue_authorized ? <>
        <Input className="h-8 w-64" placeholder="Reason to authorise a partial issue" value={partialReasonDraft} onChange={(e) => setPartialReasonDraft(e.target.value)} />
        <Button size="sm" variant="destructive" disabled={acting} onClick={onAuthorizePartialIssue}>Authorise partial issue</Button>
      </> : <Button size="sm" disabled={acting} onClick={onIssue}>Issue components (partial, authorised)</Button>}
    </ActionBar>;
  }
  if (job.status === "materials_reserved") {
    return <ActionBar><Button size="sm" disabled={acting} onClick={onIssue}>Issue components</Button></ActionBar>;
  }
  if (job.status === "issued" || job.status === "in_progress") {
    return <ActionBar>
      <Input className="h-8 w-28" placeholder="Completed qty" value={completedQtyDraft} onChange={(e) => setCompletedQtyDraft(e.target.value)} />
      <Button size="sm" disabled={acting} onClick={onComplete}>Send to QC</Button>
      <p className="text-[11px] text-muted-foreground">Log consumption per component in the table below first.</p>
    </ActionBar>;
  }
  if (job.status === "qc_pending") {
    return <ActionBar>
      <Input className="h-8 w-24" placeholder="Accepted" value={acceptDraft.accepted} onChange={(e) => setAcceptDraft({ ...acceptDraft, accepted: e.target.value })} />
      <Input className="h-8 w-24" placeholder="Rejected" value={acceptDraft.rejected} onChange={(e) => setAcceptDraft({ ...acceptDraft, rejected: e.target.value })} />
      <Button size="sm" disabled={acting} onClick={onAccept}>Record QC decision</Button>
    </ActionBar>;
  }
  if (job.status === "accepted" || job.status === "partially_accepted") {
    const pending = handovers.filter((handover) => handover.status === "pending_acknowledgement");
    return <div className="space-y-3">
      <ActionBar>
        <Truck className="h-4 w-4 text-muted-foreground" />
        <Select value={handoverDraft.destinationType} onValueChange={(value) => setHandoverDraft({ ...handoverDraft, destinationType: value })}>
          <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
          <SelectContent>{destinationTypes.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
        </Select>
        <Input className="h-8 w-40" placeholder="Destination reference" value={handoverDraft.destinationReference} onChange={(e) => setHandoverDraft({ ...handoverDraft, destinationReference: e.target.value })} />
        <Input className="h-8 w-20" placeholder="Qty" value={handoverDraft.qty} onChange={(e) => setHandoverDraft({ ...handoverDraft, qty: e.target.value })} />
        <Input className="h-8 w-20" placeholder="Cartons" value={handoverDraft.cartons} onChange={(e) => setHandoverDraft({ ...handoverDraft, cartons: e.target.value })} />
        <Input className="h-8 w-32" placeholder="Trace evidence ref" value={handoverDraft.evidence} onChange={(e) => setHandoverDraft({ ...handoverDraft, evidence: e.target.value })} />
        <Button size="sm" disabled={acting} onClick={onInitiateHandover}>Dispatch (initiate handover)</Button>
      </ActionBar>
      {pending.length > 0 && <div className="space-y-2 rounded-lg border p-3">
        <p className="text-xs font-semibold">Pending receiver acknowledgement</p>
        {pending.map((handover) => {
          const draft = ackDraft[handover.id] ?? { qty: String(handover.dispatched_qty), evidence: "" };
          const setDraft = (patch: Partial<typeof draft>) => setAckDraft({ ...ackDraft, [handover.id]: { ...draft, ...patch } });
          return <div key={handover.id} className="flex flex-wrap items-center gap-2 text-xs">
            <span>{handover.destination_type} · {handover.destination_reference} · {formatQty(handover.dispatched_qty)} dispatched</span>
            <Input className="h-7 w-20" placeholder="Received qty" value={draft.qty} onChange={(e) => setDraft({ qty: e.target.value })} />
            <Input className="h-7 w-32" placeholder="Receipt evidence" value={draft.evidence} onChange={(e) => setDraft({ evidence: e.target.value })} />
            <Button size="sm" variant="outline" className="h-7 px-2" disabled={acting} onClick={() => onAcknowledgeHandover(handover.id, handover.dispatched_qty)}>Acknowledge as receiver</Button>
          </div>;
        })}
      </div>}
    </div>;
  }
  if (job.status === "reconciliation_pending") {
    const hasVariance = computedVariance !== null && computedVariance !== 0;
    return <ActionBar>
      <div className={`flex h-8 items-center rounded-md border px-3 text-xs font-semibold ${computedVariance === null ? "text-muted-foreground" : hasVariance ? "border-destructive/40 bg-destructive/5 text-destructive" : "border-emerald-200 bg-emerald-50/40"}`}>
        {computedVariance === null ? "Computing server variance…" : `Server-computed variance: ${formatQty(computedVariance)}`}
      </div>
      <Textarea className="h-8 min-h-8 w-64 py-1.5 text-xs" placeholder="Notes (required if the server-computed variance is non-zero: return/waste/rework/transfer)" value={reconcileDraft.notes} onChange={(e) => setReconcileDraft({ ...reconcileDraft, notes: e.target.value })} />
      <Button size="sm" disabled={acting || computedVariance === null} onClick={onReconcile}>Reconcile (to Job Completed)</Button>
    </ActionBar>;
  }
  if (job.status === "job_completed") {
    return <ActionBar><Button size="sm" disabled={acting} onClick={onClose}>Close job</Button></ActionBar>;
  }
  if (job.status === "rejected" && !job.job_closed_at) {
    return <ActionBar><Button size="sm" variant="destructive" disabled={acting} onClick={onClose}>Close rejected job</Button></ActionBar>;
  }
  return null;
}
function ActionBar({ children }: { children: ReactNode }) { return <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/20 p-3">{children}</div>; }
function Metric({ icon: Icon, label, value, tone }: { icon: typeof Scale; label: string; value: number; tone: "olive" | "red" | "amber" }) { return <Card><CardContent className="flex items-center gap-3 p-4"><Icon className={`h-5 w-5 ${tone === "red" ? "text-destructive" : tone === "amber" ? "text-amber-600" : "text-primary"}`} /><div><p className="text-2xl font-bold">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div></CardContent></Card>; }
function Empty({ text }: { text: string }) { return <p className="py-10 text-center text-sm text-muted-foreground">{text}</p>; }
