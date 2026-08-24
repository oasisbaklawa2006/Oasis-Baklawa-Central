import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Factory, PackageCheck, RefreshCw, ShieldCheck, Truck, Warehouse } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { rgsGovernedRpc } from "@/lib/rgsGovernedRpc";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  reservation_id: string | null;
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
  declared_qty: number | null;
  received_qty: number | null;
  accepted_qty: number | null;
  rejected_qty: number | null;
  hold_qty: number | null;
  status: string | null;
  batch_number: string | null;
  rgs_notified: boolean | null;
  created_at: string | null;
};
type Reservation = {
  id: string;
  order_id: string | null;
  product_id: string | null;
  sku: string;
  requested_qty: number;
  reserved_qty: number;
  fulfilled_qty: number;
  released_qty: number;
  reservation_status: string;
  location_code: string;
  created_at: string | null;
};
type IssueEvent = {
  id: string;
  reservation_id: string;
  product_id: string | null;
  sku: string;
  issued_qty: number;
  acknowledged_qty: number | null;
  status: string;
  destination_type: string;
  destination_reference: string | null;
  source_location: string;
  issued_at: string | null;
};
type DemandState = Demand & {
  sku: string;
  requestedQty: number;
  availableQty: number;
  shortageQty: number;
  jobs: ProductionJob[];
  reservations: Reservation[];
};
type QueueFilter = "shortages" | "production" | "receipts" | "all";
const destinationTypes = ["b2b", "pna", "outlet", "internal"] as const;

type GovernedRpcError = { message: string } | null;
async function callGovernedRpc(fn: string, args: Record<string, unknown>): Promise<GovernedRpcError> {
  const { error } = await rgsGovernedRpc.rpc(fn, args);
  return error;
}

const openJobStatuses = new Set(["pending", "accepted", "in_production", "paused"]);
const activeOrderStatuses = ["approved", "in_production", "manufacturing", "partial_ready"];

/** RGS is the business-facing alias of the canonical FINISHED_GOODS store. */
export default function ReadyGoodsStore() {
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [demand, setDemand] = useState<Demand[]>([]);
  const [jobs, setJobs] = useState<ProductionJob[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [issueEvents, setIssueEvents] = useState<IssueEvent[]>([]);
  const [filter, setFilter] = useState<QueueFilter>("shortages");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [availabilityResult, demandResult, jobsResult, transfersResult, reservationsResult, issueEventsResult] = await Promise.all([
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
          .select("id, order_item_id, order_id, product_id, department, reservation_id, assigned_qty, produced_qty, batch_number, priority, stage, status, created_at")
          .order("created_at", { ascending: false })
          .limit(500),
        operationsDb.from("production_rgs_transfers")
          .select("id, job_id, product_id, quantity, declared_qty, received_qty, accepted_qty, rejected_qty, hold_qty, status, batch_number, rgs_notified, created_at")
          .order("created_at", { ascending: false })
          .limit(500),
        operationsDb.from("inventory_reservations")
          .select("id, order_id, product_id, sku, requested_qty, reserved_qty, fulfilled_qty, released_qty, reservation_status, location_code, created_at")
          .order("created_at", { ascending: false })
          .limit(500),
        operationsDb.from("rgs_issue_events")
          .select("id, reservation_id, product_id, sku, issued_qty, acknowledged_qty, status, destination_type, destination_reference, source_location, issued_at")
          .order("issued_at", { ascending: false })
          .limit(500),
      ]);
      const failed = availabilityResult.error ?? demandResult.error ?? jobsResult.error ?? transfersResult.error
        ?? reservationsResult.error ?? issueEventsResult.error;
      if (failed) throw failed;
      const nextDemand = (demandResult.data ?? []) as Demand[];
      setAvailability((availabilityResult.data ?? []) as Availability[]);
      setDemand(nextDemand);
      setJobs((jobsResult.data ?? []) as ProductionJob[]);
      setTransfers((transfersResult.data ?? []) as Transfer[]);
      setReservations((reservationsResult.data ?? []) as Reservation[]);
      setIssueEvents((issueEventsResult.data ?? []) as IssueEvent[]);
      setSelectedId((current) => current && nextDemand.some((row) => row.id === current) ? current : nextDemand[0]?.id ?? null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unexpected RGS data error");
      setAvailability([]);
      setDemand([]);
      setJobs([]);
      setTransfers([]);
      setReservations([]);
      setIssueEvents([]);
      setSelectedId(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const [acting, setActing] = useState<string | null>(null);
  const [receiptQtyById, setReceiptQtyById] = useState<Record<string, string>>({});
  const [acceptQtyById, setAcceptQtyById] = useState<Record<string, { accepted: string; rejected: string; hold: string }>>({});
  const [pickQtyById, setPickQtyById] = useState<Record<string, string>>({});
  const [issueById, setIssueById] = useState<Record<string, { qty: string; destinationType: string; destinationRef: string }>>({});
  const [releaseById, setReleaseById] = useState<Record<string, { qty: string; reason: string }>>({});
  const [ackQtyById, setAckQtyById] = useState<Record<string, string>>({});

  const handleAllocateAndRouteShortage = useCallback(async (row: DemandState) => {
    if (!row.product_id) { toast.error("Demand line has no product mapped"); return; }
    setActing(row.id);
    try {
      const reserveArgs = {
        p_reservation_number: `RGS-${row.id.slice(0, 8).toUpperCase()}`,
        p_order_id: row.order_id,
        p_product_id: row.product_id,
        p_sku: row.sku,
        p_requested_qty: row.requestedQty,
        p_source_department: "B2B",
        p_correlation_id: crypto.randomUUID(),
        p_location_code: "FINISHED_GOODS",
      };
      const { data: reservation, error: reserveError } = await rgsGovernedRpc.rpc("reserve_rgs_stock", reserveArgs);
      if (reserveError) { toast.error(reserveError.message || "Could not reserve stock"); return; }

      const shortage = Number(reservation?.requested_qty ?? 0) - Number(reservation?.reserved_qty ?? 0)
        - Number(reservation?.fulfilled_qty ?? 0) - Number(reservation?.released_qty ?? 0);
      if (shortage <= 0) {
        toast.success(`Reserved ${row.sku} in full from RGS stock`);
        void load();
        return;
      }

      const department = row.product?.production_department;
      if (!department) {
        toast.warning(`Reserved what was available; ${shortage} short with no production department mapped for ${row.sku}`);
        void load();
        return;
      }
      const shortageError = await callGovernedRpc("create_production_shortage_demand", {
        p_reservation_id: reservation.id,
        p_department: department,
        p_priority: row.order?.status === "approved" ? "normal" : "urgent",
        p_correlation_id: crypto.randomUUID(),
      });
      if (shortageError) { toast.error(shortageError.message || "Could not route shortage to production"); return; }
      toast.success(`Reserved what was available; routed ${shortage} short of ${row.sku} to Production`);
      void load();
    } finally {
      setActing(null);
    }
  }, [load]);

  const handleRecordReceipt = useCallback(async (transfer: Transfer) => {
    const qty = Number(receiptQtyById[transfer.id]);
    if (!qty || qty < 0) { toast.error("Enter a valid received quantity"); return; }
    setActing(transfer.id);
    const error = await callGovernedRpc("record_rgs_receipt", {
      p_transfer_id: transfer.id,
      p_received_qty: qty,
      p_correlation_id: crypto.randomUUID(),
    });
    if (error) toast.error(error.message || "Could not record receipt");
    else { toast.success("Physical receipt recorded; awaiting acceptance"); void load(); }
    setActing(null);
  }, [receiptQtyById, load]);

  const handleAcceptReceipt = useCallback(async (transfer: Transfer) => {
    const entry = acceptQtyById[transfer.id];
    const accepted = Number(entry?.accepted ?? 0);
    const rejected = Number(entry?.rejected ?? 0);
    const hold = Number(entry?.hold ?? 0);
    if (accepted + rejected + hold !== Number(transfer.received_qty ?? 0)) {
      toast.error(`Accepted + rejected + hold must equal the received quantity (${transfer.received_qty ?? 0})`);
      return;
    }
    if (!transfer.product_id) { toast.error("Transfer has no product mapped"); return; }
    setActing(transfer.id);
    try {
      const balanceDb = supabase as unknown as { from: (relation: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any
      const { data: balance } = await balanceDb
        .from("inventory_stock_balances")
        .select("version")
        .eq("product_id", transfer.product_id)
        .eq("location_code", "FINISHED_GOODS")
        .maybeSingle();
      const error = await callGovernedRpc("accept_rgs_production_receipt", {
        p_transfer_id: transfer.id,
        p_accepted_qty: accepted,
        p_rejected_qty: rejected,
        p_hold_qty: hold,
        p_expected_balance_version: balance?.version ?? 0,
        p_correlation_id: crypto.randomUUID(),
      });
      if (error) toast.error(error.message || "Could not accept receipt");
      else { toast.success(`Accepted ${accepted} into RGS stock`); void load(); }
    } finally {
      setActing(null);
    }
  }, [acceptQtyById, load]);

  const handlePickReservation = useCallback(async (reservation: Reservation) => {
    const qty = Number(pickQtyById[reservation.id]);
    if (!qty || qty <= 0) { toast.error("Enter a valid pick quantity"); return; }
    setActing(reservation.id);
    const error = await callGovernedRpc("pick_rgs_reservation", {
      p_reservation_id: reservation.id,
      p_pick_qty: qty,
      p_correlation_id: crypto.randomUUID(),
    });
    if (error) toast.error(error.message || "Could not record pick");
    else { toast.success(`Picked ${qty} ${reservation.sku}`); void load(); }
    setActing(null);
  }, [pickQtyById, load]);

  const handleIssueStock = useCallback(async (reservation: Reservation) => {
    const entry = issueById[reservation.id];
    const qty = Number(entry?.qty ?? 0);
    const destinationType = entry?.destinationType ?? "b2b";
    if (!qty || qty <= 0) { toast.error("Enter a valid issue quantity"); return; }
    setActing(reservation.id);
    const error = await callGovernedRpc("issue_rgs_stock", {
      p_reservation_id: reservation.id,
      p_issue_qty: qty,
      p_destination_type: destinationType,
      p_destination_reference: entry?.destinationRef || null,
      p_correlation_id: crypto.randomUUID(),
    });
    if (error) toast.error(error.message || "Could not issue stock");
    else { toast.success(`Issued ${qty} ${reservation.sku} to ${destinationType}`); void load(); }
    setActing(null);
  }, [issueById, load]);

  // release_rgs_reservation had zero callers anywhere in Central before
  // this -- reserve_rgs_stock and pick_rgs_reservation were wired, but a
  // reservation that's no longer needed (order cancelled, demand reduced)
  // had no governed path back to available stock.
  //
  // release_rgs_reservation's ONLY idempotency guard is a correlation_id
  // lookup against inventory_movements -- there is no state-based replay
  // protection for a PARTIAL release (unlike a full release, which flips
  // reservation_status to 'released' and so fails the "releasable state"
  // check on retry). A fresh crypto.randomUUID() per call -- this file's
  // convention for every OTHER action here -- would let a lost-response
  // retry of a partial release double-execute: reserved_qty decremented
  // twice, available_qty credited twice, for stock that was only actually
  // released once. Persist one correlation id per (reservation, qty,
  // reason) so a genuine retry of the same request reuses it and hits the
  // RPC's own idempotent early-return; changing the qty or reason before
  // retrying is a materially different request and legitimately gets a
  // fresh one.
  const releaseCorrelationRef = useRef<Record<string, { qty: string; reason: string; correlationId: string }>>({});
  const handleReleaseReservation = useCallback(async (reservation: Reservation) => {
    const entry = releaseById[reservation.id];
    const qty = Number(entry?.qty ?? 0);
    const reason = entry?.reason?.trim();
    if (!qty || qty <= 0) { toast.error("Enter a valid release quantity"); return; }
    if (!reason) { toast.error("A reason is required to release a reservation"); return; }

    const qtyKey = entry?.qty ?? "";
    const cached = releaseCorrelationRef.current[reservation.id];
    const correlationId = cached && cached.qty === qtyKey && cached.reason === reason
      ? cached.correlationId
      : crypto.randomUUID();
    releaseCorrelationRef.current[reservation.id] = { qty: qtyKey, reason, correlationId };

    setActing(reservation.id);
    const error = await callGovernedRpc("release_rgs_reservation", {
      p_reservation_id: reservation.id,
      p_release_qty: qty,
      p_reason_code: reason,
      p_correlation_id: correlationId,
    });
    if (error) toast.error(error.message || "Could not release the reservation");
    else {
      toast.success(`Released ${qty} ${reservation.sku} back to available stock`);
      delete releaseCorrelationRef.current[reservation.id];
      setReleaseById((prev) => { const next = { ...prev }; delete next[reservation.id]; return next; });
      void load();
    }
    setActing(null);
  }, [releaseById, load]);

  const handleAcknowledgeIssue = useCallback(async (issue: IssueEvent) => {
    const qty = Number(ackQtyById[issue.id] ?? issue.issued_qty);
    if (!qty || qty < 0) { toast.error("Enter a valid acknowledged quantity"); return; }
    setActing(issue.id);
    const error = await callGovernedRpc("acknowledge_rgs_issue", {
      p_issue_id: issue.id,
      p_acknowledged_qty: qty,
      p_correlation_id: crypto.randomUUID(),
    });
    if (error) toast.error(error.message || "Could not acknowledge handover");
    else { toast.success(`Handover acknowledged for ${issue.sku}`); void load(); }
    setActing(null);
  }, [ackQtyById, load]);

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
      const rowReservations = reservations.filter((reservation) =>
        reservation.order_id === row.order_id && reservation.product_id != null && reservation.product_id === row.product_id,
      );
      return {
        ...row,
        sku: row.product?.sku ?? "SKU not assigned",
        requestedQty,
        availableQty: allocated,
        shortageQty: Math.max(requestedQty - allocated, 0),
        jobs: rowJobs,
        reservations: rowReservations,
      };
    });
  }, [availability, demand, jobs, reservations]);

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
  const selectedIssueEvents = selected
    ? issueEvents.filter((issue) => selected.reservations.some((reservation) => reservation.id === issue.reservation_id))
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

      <Card className="border-emerald-200 bg-emerald-50/40">
        <CardContent className="flex gap-3 p-4 text-sm">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
          <div><p className="font-semibold">Governed custody actions</p><p className="text-muted-foreground">Allocation, shortage routing, receipt recording and acceptance now post through oasis-supabase-core's governed RPCs. Every action is idempotent and only accepted quantity ever posts to permanent RGS stock.</p></div>
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
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold">Shortage routing and production correlation</h2>
                  {selected.shortageQty > 0 && (
                    <Button size="sm" disabled={acting === selected.id} onClick={() => void handleAllocateAndRouteShortage(selected)}>
                      {acting === selected.id ? "Working…" : "Allocate & route shortage"}
                    </Button>
                  )}
                </div>
                <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Job</TableHead><TableHead>Department</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Assigned</TableHead><TableHead className="text-right">Produced</TableHead><TableHead>Batch</TableHead></TableRow></TableHeader><TableBody>{selected.jobs.map((job) => <TableRow key={job.id}><TableCell className="font-mono text-xs">{shortRef(job.id)}</TableCell><TableCell>{job.department}</TableCell><TableCell><StatusBadge status={job.status} /></TableCell><TableCell className="text-right">{formatQty(job.assigned_qty)}</TableCell><TableCell className="text-right">{formatQty(job.produced_qty ?? 0)}</TableCell><TableCell>{job.batch_number ?? "Pending"}</TableCell></TableRow>)}</TableBody></Table></div>
                {!selected.jobs.length && <Empty text={selected.shortageQty > 0 ? "Shortage identified; use “Allocate & route shortage” to reserve available stock and send the exact remainder to Production." : "No production job is required for this demand."} />}
              </section>

              <section className="space-y-3">
                <h2 className="text-sm font-semibold">Production-to-RGS receipt evidence</h2>
                <div className="space-y-2">
                  {selectedTransfers.map((transfer) => (
                    <div key={transfer.id} className="rounded-lg border p-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-xs">{shortRef(transfer.id)}</span>
                          <Badge variant="outline" className="text-[10px] uppercase">{transfer.status ?? "in_transit"}</Badge>
                          <span className="text-xs text-muted-foreground">
                            declared {formatQty(transfer.declared_qty ?? transfer.quantity)} · dispatched {formatQty(transfer.quantity)}
                            {transfer.received_qty != null && ` · received ${formatQty(transfer.received_qty)}`}
                            {transfer.accepted_qty != null && ` · accepted ${formatQty(transfer.accepted_qty)}`}
                          </span>
                        </div>
                      </div>
                      {transfer.status === "in_transit" && (
                        <div className="mt-2 flex items-center gap-2">
                          <Input type="number" step="0.001" placeholder="Received qty" className="h-8 w-32 text-xs"
                            value={receiptQtyById[transfer.id] ?? ""}
                            onChange={(e) => setReceiptQtyById((prev) => ({ ...prev, [transfer.id]: e.target.value }))} />
                          <Button size="sm" variant="outline" disabled={acting === transfer.id} onClick={() => void handleRecordReceipt(transfer)}>
                            {acting === transfer.id ? "Working…" : "Record receipt"}
                          </Button>
                        </div>
                      )}
                      {transfer.status === "received" && (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Input type="number" step="0.001" placeholder="Accepted" className="h-8 w-24 text-xs"
                            value={acceptQtyById[transfer.id]?.accepted ?? ""}
                            onChange={(e) => setAcceptQtyById((prev) => ({ ...prev, [transfer.id]: { accepted: e.target.value, rejected: prev[transfer.id]?.rejected ?? "0", hold: prev[transfer.id]?.hold ?? "0" } }))} />
                          <Input type="number" step="0.001" placeholder="Rejected" className="h-8 w-24 text-xs"
                            value={acceptQtyById[transfer.id]?.rejected ?? ""}
                            onChange={(e) => setAcceptQtyById((prev) => ({ ...prev, [transfer.id]: { accepted: prev[transfer.id]?.accepted ?? "0", rejected: e.target.value, hold: prev[transfer.id]?.hold ?? "0" } }))} />
                          <Input type="number" step="0.001" placeholder="Hold" className="h-8 w-24 text-xs"
                            value={acceptQtyById[transfer.id]?.hold ?? ""}
                            onChange={(e) => setAcceptQtyById((prev) => ({ ...prev, [transfer.id]: { accepted: prev[transfer.id]?.accepted ?? "0", rejected: prev[transfer.id]?.rejected ?? "0", hold: e.target.value } }))} />
                          <Button size="sm" disabled={acting === transfer.id} onClick={() => void handleAcceptReceipt(transfer)}>
                            {acting === transfer.id ? "Working…" : "Accept into RGS stock"}
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {!selectedTransfers.length && <Empty text="No Production-to-RGS transfer evidence is linked to this demand." />}
              </section>

              <section className="space-y-3">
                <h2 className="text-sm font-semibold">Picking &amp; issue</h2>
                <div className="space-y-2">
                  {selected.reservations.map((reservation) => (
                    <div key={reservation.id} className="rounded-lg border p-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-xs">{shortRef(reservation.id)}</span>
                          <Badge variant="outline" className="text-[10px] uppercase">{reservation.reservation_status.replace(/_/g, " ")}</Badge>
                          <span className="text-xs text-muted-foreground">
                            reserved {formatQty(reservation.reserved_qty)} · fulfilled {formatQty(reservation.fulfilled_qty)} of {formatQty(reservation.requested_qty)}
                          </span>
                        </div>
                      </div>
                      {reservation.reserved_qty > 0 && (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Input type="number" step="0.001" placeholder="Pick qty" className="h-8 w-28 text-xs"
                            value={pickQtyById[reservation.id] ?? ""}
                            onChange={(e) => setPickQtyById((prev) => ({ ...prev, [reservation.id]: e.target.value }))} />
                          <Button size="sm" variant="outline" disabled={acting === reservation.id} onClick={() => void handlePickReservation(reservation)}>
                            {acting === reservation.id ? "Working…" : "Record pick"}
                          </Button>
                          <Input type="number" step="0.001" placeholder="Issue qty" className="h-8 w-28 text-xs"
                            value={issueById[reservation.id]?.qty ?? ""}
                            onChange={(e) => setIssueById((prev) => ({ ...prev, [reservation.id]: { qty: e.target.value, destinationType: prev[reservation.id]?.destinationType ?? "b2b", destinationRef: prev[reservation.id]?.destinationRef ?? "" } }))} />
                          <Select value={issueById[reservation.id]?.destinationType ?? "b2b"}
                            onValueChange={(value) => setIssueById((prev) => ({ ...prev, [reservation.id]: { qty: prev[reservation.id]?.qty ?? "", destinationType: value, destinationRef: prev[reservation.id]?.destinationRef ?? "" } }))}>
                            <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>{destinationTypes.map((type) => <SelectItem key={type} value={type} className="uppercase">{type}</SelectItem>)}</SelectContent>
                          </Select>
                          <Input placeholder="Destination ref" className="h-8 w-32 text-xs"
                            value={issueById[reservation.id]?.destinationRef ?? ""}
                            onChange={(e) => setIssueById((prev) => ({ ...prev, [reservation.id]: { qty: prev[reservation.id]?.qty ?? "", destinationType: prev[reservation.id]?.destinationType ?? "b2b", destinationRef: e.target.value } }))} />
                          <Button size="sm" disabled={acting === reservation.id} onClick={() => void handleIssueStock(reservation)}>
                            {acting === reservation.id ? "Working…" : "Issue stock"}
                          </Button>
                          <Input type="number" step="0.001" placeholder="Release qty" className="h-8 w-28 text-xs"
                            value={releaseById[reservation.id]?.qty ?? ""}
                            onChange={(e) => setReleaseById((prev) => ({ ...prev, [reservation.id]: { qty: e.target.value, reason: prev[reservation.id]?.reason ?? "" } }))} />
                          <Input placeholder="Reason (e.g. order_cancelled)" className="h-8 w-44 text-xs"
                            value={releaseById[reservation.id]?.reason ?? ""}
                            onChange={(e) => setReleaseById((prev) => ({ ...prev, [reservation.id]: { qty: prev[reservation.id]?.qty ?? "", reason: e.target.value } }))} />
                          <Button size="sm" variant="destructive" disabled={acting === reservation.id} onClick={() => void handleReleaseReservation(reservation)}>
                            {acting === reservation.id ? "Working…" : "Release"}
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {!selected.reservations.length && <Empty text="No RGS stock reservation exists yet for this demand." />}
              </section>

              <section className="space-y-3">
                <h2 className="flex items-center gap-2 text-sm font-semibold"><Truck className="h-4 w-4 text-primary" />Handover acknowledgement</h2>
                <div className="space-y-2">
                  {selectedIssueEvents.map((issue) => (
                    <div key={issue.id} className="rounded-lg border p-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-xs">{shortRef(issue.id)}</span>
                          <Badge variant={issue.status === "variance" ? "destructive" : "outline"} className="text-[10px] uppercase">{issue.status}</Badge>
                          <span className="text-xs text-muted-foreground">
                            issued {formatQty(issue.issued_qty)} to {issue.destination_type}
                            {issue.destination_reference && ` (${issue.destination_reference})`}
                            {issue.acknowledged_qty != null && ` · acknowledged ${formatQty(issue.acknowledged_qty)}`}
                          </span>
                        </div>
                      </div>
                      {issue.status === "issued" && (
                        <div className="mt-2 flex items-center gap-2">
                          <Input type="number" step="0.001" placeholder={`Ack qty (${issue.issued_qty})`} className="h-8 w-32 text-xs"
                            value={ackQtyById[issue.id] ?? ""}
                            onChange={(e) => setAckQtyById((prev) => ({ ...prev, [issue.id]: e.target.value }))} />
                          <Button size="sm" disabled={acting === issue.id} onClick={() => void handleAcknowledgeIssue(issue)}>
                            {acting === issue.id ? "Working…" : "Acknowledge handover"}
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {!selectedIssueEvents.length && <Empty text="No stock has been issued out of RGS for this demand yet." />}
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
