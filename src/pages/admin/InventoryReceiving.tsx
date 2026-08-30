import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, ClipboardList, MapPin, PackageSearch, RefreshCw, ScanBarcode, Scale, Truck } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// Temporary typed boundary for live Phase 2 relations pending regenerated
// project-wide Supabase definitions.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fulfilmentDb = supabase as unknown as { from: (relation: string) => any; rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> };

type Receipt = {
  id: string;
  receipt_number: string;
  receipt_source: string;
  destination_store_code: string;
  source_document_type: string;
  source_document_reference: string;
  status: string;
  received_at: string | null;
  created_at: string;
};

type ReceiptLine = {
  id: string;
  receipt_id: string;
  sku: string;
  supplier_batch_lot: string | null;
  oasis_batch_lot: string | null;
  expiry_date: string | null;
  expected_qty: number;
  received_qty: number;
  accepted_qty: number;
  damaged_qty: number;
  rejected_qty: number;
  shortage_qty: number;
  excess_qty: number;
};
type PutawayTask = { id: string; receipt_line_id: string; bin_id: string; disposition: string; allocated_qty: number; placed_qty: number; status: string; b2b_inventory_bins: { bin_code: string; store_code: string; zone_code: string; rack_code: string; shelf_code: string } | null };
type Grn = { receipt_id: string; grn_number: string; status: string; finalised_at: string | null };
type Bin = { id: string; store_code: string; zone_code: string; rack_code: string; shelf_code: string; bin_code: string; storage_class: string; active: boolean };
type Discrepancy = { id: string; receipt_line_id: string; discrepancy_type: string; quantity: number | null; status: string; resolution: string | null; resolved_at: string | null; created_at: string };

const OPEN_DISCREPANCY_STATUSES = new Set(["open", "supplier_contacted", "awaiting_credit", "replacement_due"]);
const DISCREPANCY_RESOLUTION_STATUSES = ["supplier_contacted", "awaiting_credit", "replacement_due", "resolved", "waived"] as const;
// A disposition of 'accepted' must not land in a bin reserved for
// quarantine/damaged/rejected/return-to-vendor stock, and vice versa --
// this mirrors allocate_b2b_inventory_putaway's own storage-class check
// exactly, so the picker can never offer a bin the RPC would reject.
function isEligibleBin(bin: Bin, disposition: "accepted" | "damaged" | "rejected"): boolean {
  const restricted = new Set(["quarantine", "damaged", "rejected", "return_to_vendor"]);
  return disposition === "accepted" ? !restricted.has(bin.storage_class) : bin.storage_class !== "ambient";
}

const terminalStatuses = new Set(["accepted", "rejected", "cancelled"]);

/** Operational receipt evidence. Posting and acceptance remain server-controlled. */
export default function InventoryReceiving() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [lines, setLines] = useState<ReceiptLine[]>([]);
  const [tasks, setTasks] = useState<PutawayTask[]>([]);
  const [grns, setGrns] = useState<Grn[]>([]);
  const [bins, setBins] = useState<Bin[]>([]);
  const [discrepancies, setDiscrepancies] = useState<Discrepancy[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"open" | "all" | "exceptions">("open");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const receiptResult = await fulfilmentDb.from("b2b_inventory_receipts").select("id, receipt_number, receipt_source, destination_store_code, source_document_type, source_document_reference, status, received_at, created_at").order("created_at", { ascending: false }).limit(100);
      if (receiptResult.error) throw receiptResult.error;
      const nextReceipts = (receiptResult.data ?? []) as Receipt[];
      const lineResult = nextReceipts.length
        ? await fulfilmentDb.from("b2b_inventory_receipt_lines").select("id, receipt_id, sku, supplier_batch_lot, oasis_batch_lot, expiry_date, expected_qty, received_qty, accepted_qty, damaged_qty, rejected_qty, shortage_qty, excess_qty").in("receipt_id", nextReceipts.map((receipt) => receipt.id)).order("created_at", { ascending: true })
        : { data: [], error: null };
      if (lineResult.error) throw lineResult.error;
      const receiptIds = nextReceipts.map((receipt) => receipt.id);
      const nextLines = (lineResult.data ?? []) as ReceiptLine[];
      const lineIds = nextLines.map((line) => line.id);
      const [taskResult, grnResult, binResult, discrepancyResult] = await Promise.all([
        lineIds.length
          ? fulfilmentDb.from("b2b_inventory_putaway_tasks").select("id, receipt_line_id, bin_id, disposition, allocated_qty, placed_qty, status, b2b_inventory_bins(bin_code, store_code, zone_code, rack_code, shelf_code)").in("receipt_line_id", lineIds).order("created_at", { ascending: true })
          : { data: [], error: null },
        receiptIds.length
          ? fulfilmentDb.from("b2b_inventory_grns").select("receipt_id, grn_number, status, finalised_at").in("receipt_id", receiptIds).order("created_at", { ascending: false })
          : { data: [], error: null },
        fulfilmentDb.from("b2b_inventory_bins").select("id, store_code, zone_code, rack_code, shelf_code, bin_code, storage_class, active").eq("active", true).order("bin_code", { ascending: true }),
        lineIds.length
          ? fulfilmentDb.from("b2b_supplier_discrepancies").select("id, receipt_line_id, discrepancy_type, quantity, status, resolution, resolved_at, created_at").in("receipt_line_id", lineIds).order("created_at", { ascending: false })
          : { data: [], error: null },
      ]);
      if (taskResult.error) throw taskResult.error;
      if (grnResult.error) throw grnResult.error;
      if (binResult.error) throw binResult.error;
      if (discrepancyResult.error) throw discrepancyResult.error;
      setReceipts(nextReceipts);
      setLines(nextLines);
      setTasks((taskResult.data ?? []) as PutawayTask[]);
      setGrns((grnResult.data ?? []) as Grn[]);
      setBins((binResult.data ?? []) as Bin[]);
      setDiscrepancies((discrepancyResult.data ?? []) as Discrepancy[]);
      setSelectedId((current) => current && nextReceipts.some((receipt) => receipt.id === current) ? current : nextReceipts[0]?.id ?? null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unexpected receiving data error");
      setReceipts([]); setLines([]); setTasks([]); setGrns([]); setBins([]); setDiscrepancies([]); setSelectedId(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const exceptionReceiptIds = useMemo(() => new Set(lines.filter(hasVariance).map((line) => line.receipt_id)), [lines]);
  const visibleReceipts = receipts.filter((receipt) => {
    if (filter === "open") return !terminalStatuses.has(receipt.status);
    if (filter === "exceptions") return exceptionReceiptIds.has(receipt.id);
    return true;
  });
  const selected = receipts.find((receipt) => receipt.id === selectedId) ?? null;
  const selectedLines = lines.filter((line) => line.receipt_id === selectedId);
  const openCount = receipts.filter((receipt) => !terminalStatuses.has(receipt.status)).length;
  const exceptionCount = exceptionReceiptIds.size;
  const acceptedQty = selectedLines.reduce((total, line) => total + Number(line.accepted_qty), 0);
  const selectedTasks = tasks.filter((task) => selectedLines.some((line) => line.id === task.receipt_line_id));
  const selectedGrn = grns.find((grn) => grn.receipt_id === selectedId) ?? null;
  const selectedBins = bins.filter((bin) => bin.store_code === selected?.destination_store_code);
  const selectedDiscrepancies = discrepancies.filter((discrepancy) => selectedLines.some((line) => line.id === discrepancy.receipt_line_id));

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 pb-24">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <Button size="icon" variant="ghost" asChild><Link to="/admin/inventory-command-center" aria-label="Back to inventory command center"><ArrowLeft className="h-4 w-4" /></Link></Button>
          <div><h1 className="text-xl font-bold tracking-tight">Receiving & inwarding</h1><p className="text-xs text-muted-foreground">Source-linked receipt evidence · B2B fulfilment stores</p></div>
        </div>
        <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh</Button>
      </header>

      {error && <Card className="border-destructive/40"><CardContent className="flex items-center gap-2 p-4 text-sm text-destructive"><AlertTriangle className="h-4 w-4" />Receiving contract could not be read: {error}</CardContent></Card>}

      <div className="grid gap-3 sm:grid-cols-3">
        <Metric icon={Truck} label="Open receipts" value={openCount} tone={openCount ? "amber" : "olive"} />
        <Metric icon={Scale} label="Receipts with variance" value={exceptionCount} tone={exceptionCount ? "red" : "olive"} />
        <Metric icon={CheckCircle2} label="Accepted receipts" value={receipts.filter((receipt) => receipt.status === "accepted").length} tone="olive" />
      </div>

      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="flex gap-3 p-4 text-sm"><ClipboardList className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><div><p className="font-semibold">Governed Phase 4 workflow</p><p className="text-muted-foreground">Put-away scans and GRN finalisation run only through authenticated transactional RPCs. Direct stock and GRN writes remain blocked.</p></div></CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[minmax(300px,0.85fr)_minmax(0,1.65fr)]">
        <Card>
          <CardHeader className="space-y-3"><CardTitle className="text-base">Receipt queue</CardTitle><div className="flex flex-wrap gap-2">{(["open", "exceptions", "all"] as const).map((value) => <Button key={value} size="sm" variant={filter === value ? "default" : "outline"} onClick={() => setFilter(value)} className="capitalize">{value}</Button>)}</div></CardHeader>
          <CardContent className="space-y-2">
            {visibleReceipts.map((receipt) => {
              const hasException = exceptionReceiptIds.has(receipt.id);
              return <button key={receipt.id} type="button" onClick={() => setSelectedId(receipt.id)} className={`w-full rounded-lg border p-3 text-left transition-colors ${selectedId === receipt.id ? "border-primary bg-primary/5" : "hover:bg-muted/40"}`}><div className="flex items-start justify-between gap-2"><div><p className="text-sm font-semibold">{receipt.receipt_number}</p><p className="mt-1 text-xs text-muted-foreground">{receipt.receipt_source.replace(/_/g, " ")} → {receipt.destination_store_code}</p></div><StatusBadge status={receipt.status} /></div><div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground"><span>{receipt.source_document_reference}</span>{hasException && <span className="font-semibold text-destructive">Variance</span>}</div></button>;
            })}
            {!loading && !visibleReceipts.length && <Empty text="No receipts match this queue." />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><PackageSearch className="h-4 w-4 text-primary" />Receipt detail</CardTitle></CardHeader>
          <CardContent>
            {selected ? <div className="space-y-5">
              <div className="grid gap-3 rounded-lg border bg-muted/20 p-4 sm:grid-cols-2 lg:grid-cols-4">
                <Detail label="Receipt" value={selected.receipt_number} />
                <Detail label="Destination" value={selected.destination_store_code} />
                <Detail label="Source document" value={`${selected.source_document_type}: ${selected.source_document_reference}`} />
                <Detail label="Accepted quantity" value={formatQty(acceptedQty)} />
              </div>
              <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>SKU / provenance</TableHead><TableHead className="text-right">Expected</TableHead><TableHead className="text-right">Received</TableHead><TableHead className="text-right">Accepted</TableHead><TableHead className="text-right">Damaged / rejected</TableHead><TableHead>Variance</TableHead></TableRow></TableHeader><TableBody>{selectedLines.map((line) => <TableRow key={line.id}><TableCell><p className="font-medium">{line.sku}</p><p className="text-[11px] text-muted-foreground">{line.supplier_batch_lot ? `Supplier lot ${line.supplier_batch_lot}` : line.oasis_batch_lot ? `Oasis lot ${line.oasis_batch_lot}` : "Lot not recorded"}{line.expiry_date ? ` · Exp ${line.expiry_date}` : ""}</p></TableCell><TableCell className="text-right">{formatQty(line.expected_qty)}</TableCell><TableCell className="text-right">{formatQty(line.received_qty)}</TableCell><TableCell className="text-right font-medium">{formatQty(line.accepted_qty)}</TableCell><TableCell className="text-right">{formatQty(Number(line.damaged_qty) + Number(line.rejected_qty))}</TableCell><TableCell>{hasVariance(line) ? <div className="flex flex-wrap gap-1">{Number(line.shortage_qty) > 0 && <Badge variant="destructive">{formatQty(line.shortage_qty)} short</Badge>}{Number(line.excess_qty) > 0 && <Badge variant="secondary">{formatQty(line.excess_qty)} excess</Badge>}{Number(line.damaged_qty) > 0 && <Badge variant="destructive">{formatQty(line.damaged_qty)} damaged</Badge>}{Number(line.rejected_qty) > 0 && <Badge variant="destructive">{formatQty(line.rejected_qty)} rejected</Badge>}</div> : <Badge variant="outline">Matched</Badge>}</TableCell></TableRow>)}</TableBody></Table></div>
              <PutawayAllocationPanel key={`allocate-${selected.id}`} receipt={selected} lines={selectedLines} tasks={selectedTasks} bins={selectedBins} reload={load} />
              <Phase4Panel key={selected.id} receipt={selected} tasks={selectedTasks} grn={selectedGrn} reload={load} />
              <SupplierDiscrepancyPanel key={`discrepancies-${selected.id}`} lines={selectedLines} discrepancies={selectedDiscrepancies} reload={load} />
              {!selectedLines.length && <Empty text="No receipt lines have been recorded." />}
            </div> : <Empty text="Select a receipt to inspect inward evidence." />}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Phase4Panel({ receipt, tasks, grn, reload }: { receipt: Receipt; tasks: PutawayTask[]; grn: Grn | null; reload: () => Promise<void> }) {
  const [scanByTask, setScanByTask] = useState<Map<string, string>>(new Map()); const [busy, setBusy] = useState<string | null>(null); const [actionError, setActionError] = useState<string | null>(null);
  const setTaskScan = (taskId: string, value: string) => setScanByTask((current) => new Map(current).set(taskId, value));
  const confirmTask = async (task: PutawayTask) => {
    setBusy(task.id); setActionError(null);
    try {
      const { error } = await fulfilmentDb.rpc("confirm_b2b_inventory_putaway", { p_task_id: task.id, p_bin_code: (scanByTask.get(task.id) ?? "").trim(), p_quantity: Number(task.allocated_qty) - Number(task.placed_qty), p_correlation_id: `putaway:${task.id}:${Date.now()}` });
      if (error) setActionError(error.message);
      else { setTaskScan(task.id, ""); await reload(); }
    } catch (cause) { setActionError(cause instanceof Error ? cause.message : "Put-away confirmation failed"); }
    finally { setBusy(null); }
  };
  const finalise = async () => {
    setBusy("grn"); setActionError(null);
    try {
      const number = `GRN-${receipt.receipt_number}`;
      const { error } = await fulfilmentDb.rpc("finalise_b2b_inventory_grn", { p_receipt_id: receipt.id, p_grn_number: number, p_correlation_id: `grn:${receipt.id}` });
      if (error) setActionError(error.message); else await reload();
    } catch (cause) { setActionError(cause instanceof Error ? cause.message : "GRN finalisation failed"); }
    finally { setBusy(null); }
  };
  const complete = tasks.length > 0 && tasks.every((task) => task.status === "completed");
  return <section className="space-y-3 rounded-lg border border-primary/20 bg-primary/[0.03] p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="flex items-center gap-2 text-sm font-semibold"><MapPin className="h-4 w-4 text-primary" />Put-away & GRN</h2><p className="text-xs text-muted-foreground">Scan the allocated bin to confirm physical placement.</p></div>{grn ? <Badge className="bg-primary">{grn.grn_number} · {grn.status}</Badge> : <Badge variant="outline">GRN pending</Badge>}</div>{actionError && <p className="rounded border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">{actionError}</p>}<div className="space-y-2">{tasks.map((task) => <div key={task.id} className="grid gap-2 rounded-md border bg-background p-3 sm:grid-cols-[1fr_180px_auto]"><div><p className="text-sm font-medium">{task.disposition.replace(/_/g," ")} · {formatQty(task.placed_qty)}/{formatQty(task.allocated_qty)}</p><p className="text-xs text-muted-foreground">{task.b2b_inventory_bins ? `${task.b2b_inventory_bins.store_code} / ${task.b2b_inventory_bins.zone_code} / ${task.b2b_inventory_bins.rack_code} / ${task.b2b_inventory_bins.shelf_code} / ${task.b2b_inventory_bins.bin_code}` : "Bin unavailable"}</p></div>{task.status !== "completed" ? <><label className="flex items-center gap-2 rounded border px-2"><ScanBarcode className="h-4 w-4" /><input className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none" value={scanByTask.get(task.id) ?? ""} onChange={(event) => setTaskScan(task.id, event.target.value)} placeholder="Scan bin code" aria-label="Scanned bin code" /></label><Button size="sm" disabled={!(scanByTask.get(task.id) ?? "").trim() || busy !== null} onClick={() => void confirmTask(task)}>{busy === task.id ? "Confirming…" : "Confirm"}</Button></> : <div className="sm:col-span-2 flex items-center justify-end gap-1 text-xs font-medium text-primary"><CheckCircle2 className="h-4 w-4" />Placed</div>}</div>)}{!tasks.length && <p className="py-4 text-center text-xs text-muted-foreground">No put-away allocation has been issued yet.</p>}</div>{!grn && <div className="flex justify-end"><Button size="sm" disabled={!complete || busy !== null} onClick={() => void finalise()}>{busy === "grn" ? "Finalising…" : "Finalise GRN"}</Button></div>}</section>;
}

type PutawaySlot = { lineId: string; sku: string; disposition: "accepted" | "damaged" | "rejected"; quantity: number };

function slotKey(slot: Pick<PutawaySlot, "lineId" | "disposition">) { return `${slot.lineId}:${slot.disposition}`; }

function computeMissingPutawaySlots(lines: ReceiptLine[], tasks: PutawayTask[]): PutawaySlot[] {
  const slots: PutawaySlot[] = [];
  for (const line of lines) {
    (["accepted", "damaged", "rejected"] as const).forEach((disposition) => {
      const required = disposition === "accepted" ? Number(line.accepted_qty) : disposition === "damaged" ? Number(line.damaged_qty) : Number(line.rejected_qty);
      if (required <= 0) return;
      const allocated = tasks.filter((task) => task.receipt_line_id === line.id && task.disposition === disposition).reduce((sum, task) => sum + Number(task.allocated_qty), 0);
      const remaining = required - allocated;
      if (remaining > 0) slots.push({ lineId: line.id, sku: line.sku, disposition, quantity: remaining });
    });
  }
  return slots;
}

function PutawayAllocationPanel({ receipt, lines, tasks, bins, reload }: { receipt: Receipt; lines: ReceiptLine[]; tasks: PutawayTask[]; bins: Bin[]; reload: () => Promise<void> }) {
  const slots = useMemo(() => computeMissingPutawaySlots(lines, tasks), [lines, tasks]);
  const [binBySlot, setBinBySlot] = useState<Map<string, string>>(new Map());
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const setSlotBin = (key: string, binId: string) => setBinBySlot((current) => new Map(current).set(key, binId));

  const submit = async () => {
    const unfilled = slots.filter((slot) => !binBySlot.get(slotKey(slot)));
    if (unfilled.length) { setActionError("Select a bin for every open allocation before submitting."); return; }
    setBusy(true); setActionError(null);
    try {
      const allocations = slots.map((slot) => ({ line_id: slot.lineId, bin_id: binBySlot.get(slotKey(slot)), disposition: slot.disposition, quantity: slot.quantity }));
      const { error } = await fulfilmentDb.rpc("allocate_b2b_inventory_putaway", {
        p_receipt_id: receipt.id,
        p_allocations: allocations,
        p_correlation_id: `putaway-alloc:${receipt.id}:${Date.now()}`,
      });
      if (error) setActionError(error.message);
      else { setBinBySlot(new Map()); await reload(); }
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Put-away allocation failed");
    } finally {
      setBusy(false);
    }
  };

  if (!slots.length) return null;

  return (
    <section className="space-y-3 rounded-lg border border-amber-500/30 bg-amber-500/[0.04] p-4">
      <div>
        <h2 className="flex items-center gap-2 text-sm font-semibold"><MapPin className="h-4 w-4 text-amber-600" />Put-away allocation required</h2>
        <p className="text-xs text-muted-foreground">Assign a storage bin for every accepted, damaged, or rejected quantity before scanning can begin.</p>
      </div>
      {actionError && <p className="rounded border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">{actionError}</p>}
      <div className="space-y-2">
        {slots.map((slot) => {
          const key = slotKey(slot);
          const eligible = bins.filter((bin) => isEligibleBin(bin, slot.disposition));
          return (
            <div key={key} className="grid gap-2 rounded-md border bg-background p-3 sm:grid-cols-[1fr_1fr]">
              <div>
                <p className="text-sm font-medium">{slot.sku} · {slot.disposition.replace(/_/g, " ")}</p>
                <p className="text-xs text-muted-foreground">{formatQty(slot.quantity)} units to allocate</p>
              </div>
              <select
                className="rounded border bg-background px-2 py-2 text-sm"
                value={binBySlot.get(key) ?? ""}
                onChange={(event) => setSlotBin(key, event.target.value)}
                aria-label={`Bin for ${slot.sku} ${slot.disposition}`}
              >
                <option value="">Select a bin…</option>
                {eligible.map((bin) => <option key={bin.id} value={bin.id}>{bin.zone_code}/{bin.rack_code}/{bin.shelf_code}/{bin.bin_code}</option>)}
              </select>
            </div>
          );
        })}
      </div>
      <div className="flex justify-end">
        <Button size="sm" disabled={busy} onClick={() => void submit()}>{busy ? "Allocating…" : "Allocate put-away"}</Button>
      </div>
    </section>
  );
}

function SupplierDiscrepancyPanel({ lines, discrepancies, reload }: { lines: ReceiptLine[]; discrepancies: Discrepancy[]; reload: () => Promise<void> }) {
  const [resolutionById, setResolutionById] = useState<Map<string, string>>(new Map());
  const [statusById, setStatusById] = useState<Map<string, string>>(new Map());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const skuByLineId = useMemo(() => new Map(lines.map((line) => [line.id, line.sku])), [lines]);

  const setResolutionText = (id: string, value: string) => setResolutionById((current) => new Map(current).set(id, value));
  const setResolutionStatus = (id: string, value: string) => setStatusById((current) => new Map(current).set(id, value));

  const resolve = async (discrepancy: Discrepancy) => {
    const resolution = (resolutionById.get(discrepancy.id) ?? "").trim();
    if (!resolution) { setActionError("Enter resolution notes before submitting."); return; }
    setBusyId(discrepancy.id); setActionError(null);
    try {
      const { error } = await fulfilmentDb.rpc("resolve_b2b_supplier_discrepancy", {
        p_discrepancy_id: discrepancy.id,
        p_resolution: resolution,
        p_status: statusById.get(discrepancy.id) ?? "resolved",
      });
      if (error) setActionError(error.message);
      else { setResolutionText(discrepancy.id, ""); await reload(); }
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Discrepancy resolution failed");
    } finally {
      setBusyId(null);
    }
  };

  if (!discrepancies.length) return null;

  return (
    <section data-testid="supplier-discrepancy-panel" className="space-y-3 rounded-lg border border-destructive/25 bg-destructive/[0.03] p-4">
      <div>
        <h2 className="flex items-center gap-2 text-sm font-semibold"><Scale className="h-4 w-4 text-destructive" />Supplier discrepancies</h2>
        <p className="text-xs text-muted-foreground">Raised automatically from received-vs-ordered variance. Status reflects only authoritative resolution.</p>
      </div>
      {actionError && <p className="rounded border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">{actionError}</p>}
      <div className="space-y-2">
        {discrepancies.map((discrepancy) => {
          const open = OPEN_DISCREPANCY_STATUSES.has(discrepancy.status);
          return (
            <div key={discrepancy.id} className="space-y-2 rounded-md border bg-background p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">{skuByLineId.get(discrepancy.receipt_line_id) ?? "Unknown SKU"} · {discrepancy.discrepancy_type.replace(/_/g, " ")}</p>
                  <p className="text-xs text-muted-foreground">{discrepancy.quantity != null ? `${formatQty(discrepancy.quantity)} units · ` : ""}Raised {new Date(discrepancy.created_at).toLocaleDateString()}</p>
                </div>
                <Badge variant={open ? "destructive" : "outline"} className="shrink-0 text-[10px] uppercase">{discrepancy.status.replace(/_/g, " ")}</Badge>
              </div>
              {discrepancy.resolution && <p className="text-xs text-muted-foreground">Resolution: {discrepancy.resolution}{discrepancy.resolved_at ? ` · ${new Date(discrepancy.resolved_at).toLocaleDateString()}` : ""}</p>}
              {open && <div className="grid gap-2 sm:grid-cols-[1fr_180px_auto]">
                <input className="rounded border bg-background px-2 py-2 text-sm" placeholder="Resolution notes" value={resolutionById.get(discrepancy.id) ?? ""} onChange={(event) => setResolutionText(discrepancy.id, event.target.value)} aria-label={`Resolution notes for ${discrepancy.discrepancy_type}`} />
                <select className="rounded border bg-background px-2 py-2 text-sm" value={statusById.get(discrepancy.id) ?? "resolved"} onChange={(event) => setResolutionStatus(discrepancy.id, event.target.value)} aria-label={`Resolution status for ${discrepancy.discrepancy_type}`}>
                  {DISCREPANCY_RESOLUTION_STATUSES.map((status) => <option key={status} value={status}>{status.replace(/_/g, " ")}</option>)}
                </select>
                <Button size="sm" disabled={busyId !== null} onClick={() => void resolve(discrepancy)}>{busyId === discrepancy.id ? "Saving…" : "Save"}</Button>
              </div>}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function hasVariance(line: ReceiptLine) { return Number(line.shortage_qty) > 0 || Number(line.excess_qty) > 0 || Number(line.damaged_qty) > 0 || Number(line.rejected_qty) > 0; }
function formatQty(value: number) { return Number(value).toLocaleString("en-IN", { maximumFractionDigits: 3 }); }
function StatusBadge({ status }: { status: string }) { return <Badge variant={status === "rejected" ? "destructive" : "outline"} className="shrink-0 text-[10px] uppercase">{status.replace(/_/g, " ")}</Badge>; }
function Detail({ label, value }: { label: string; value: string }) { return <div><p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 text-sm font-semibold">{value}</p></div>; }
function Metric({ icon: Icon, label, value, tone }: { icon: typeof Truck; label: string; value: number; tone: "olive" | "red" | "amber" }) { return <Card><CardContent className="flex items-center gap-3 p-4"><Icon className={`h-5 w-5 ${tone === "red" ? "text-destructive" : tone === "amber" ? "text-amber-600" : "text-primary"}`} /><div><p className="text-2xl font-bold">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div></CardContent></Card>; }
function Empty({ text }: { text: string }) { return <p className="py-10 text-center text-sm text-muted-foreground">{text}</p>; }
