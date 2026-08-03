import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, ClipboardList, PackageSearch, RefreshCw, Scale, Truck } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// Temporary typed boundary for live Phase 2 relations pending regenerated
// project-wide Supabase definitions.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fulfilmentDb = supabase as unknown as { from: (relation: string) => any };

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

const terminalStatuses = new Set(["accepted", "rejected", "cancelled"]);

/** Operational receipt evidence. Posting and acceptance remain server-controlled. */
export default function InventoryReceiving() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [lines, setLines] = useState<ReceiptLine[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"open" | "all" | "exceptions">("open");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [receiptResult, lineResult] = await Promise.all([
      fulfilmentDb.from("b2b_inventory_receipts").select("id, receipt_number, receipt_source, destination_store_code, source_document_type, source_document_reference, status, received_at, created_at").order("created_at", { ascending: false }).limit(100),
      fulfilmentDb.from("b2b_inventory_receipt_lines").select("id, receipt_id, sku, supplier_batch_lot, oasis_batch_lot, expiry_date, expected_qty, received_qty, accepted_qty, damaged_qty, rejected_qty, shortage_qty, excess_qty").order("created_at", { ascending: true }).limit(500),
    ]);
    const failed = receiptResult.error ?? lineResult.error;
    if (failed) setError(failed.message);
    const nextReceipts = (receiptResult.data ?? []) as Receipt[];
    setReceipts(nextReceipts);
    setLines((lineResult.data ?? []) as ReceiptLine[]);
    setSelectedId((current) => current && nextReceipts.some((receipt) => receipt.id === current) ? current : nextReceipts[0]?.id ?? null);
    setLoading(false);
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

      <Card className="border-amber-200 bg-amber-50/40">
        <CardContent className="flex gap-3 p-4 text-sm"><ClipboardList className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" /><div><p className="font-semibold">Read-only operational evidence</p><p className="text-muted-foreground">Acceptance, rejection and stock posting require a transactional server workflow. This view intentionally cannot mutate inventory.</p></div></CardContent>
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
              <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>SKU / provenance</TableHead><TableHead className="text-right">Expected</TableHead><TableHead className="text-right">Received</TableHead><TableHead className="text-right">Accepted</TableHead><TableHead className="text-right">Damaged / rejected</TableHead><TableHead>Variance</TableHead></TableRow></TableHeader><TableBody>{selectedLines.map((line) => <TableRow key={line.id}><TableCell><p className="font-medium">{line.sku}</p><p className="text-[11px] text-muted-foreground">{line.supplier_batch_lot ? `Supplier lot ${line.supplier_batch_lot}` : line.oasis_batch_lot ? `Oasis lot ${line.oasis_batch_lot}` : "Lot not recorded"}{line.expiry_date ? ` · Exp ${line.expiry_date}` : ""}</p></TableCell><TableCell className="text-right">{formatQty(line.expected_qty)}</TableCell><TableCell className="text-right">{formatQty(line.received_qty)}</TableCell><TableCell className="text-right font-medium">{formatQty(line.accepted_qty)}</TableCell><TableCell className="text-right">{formatQty(Number(line.damaged_qty) + Number(line.rejected_qty))}</TableCell><TableCell>{hasVariance(line) ? <Badge variant="destructive">{Number(line.shortage_qty) > 0 ? `${formatQty(line.shortage_qty)} short` : `${formatQty(line.excess_qty)} excess`}</Badge> : <Badge variant="outline">Matched</Badge>}</TableCell></TableRow>)}</TableBody></Table></div>
              {!selectedLines.length && <Empty text="No receipt lines have been recorded." />}
            </div> : <Empty text="Select a receipt to inspect inward evidence." />}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function hasVariance(line: ReceiptLine) { return Number(line.shortage_qty) > 0 || Number(line.excess_qty) > 0 || Number(line.damaged_qty) > 0 || Number(line.rejected_qty) > 0; }
function formatQty(value: number) { return Number(value).toLocaleString("en-IN", { maximumFractionDigits: 3 }); }
function StatusBadge({ status }: { status: string }) { return <Badge variant={status === "rejected" ? "destructive" : "outline"} className="shrink-0 text-[10px] uppercase">{status.replace(/_/g, " ")}</Badge>; }
function Detail({ label, value }: { label: string; value: string }) { return <div><p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 text-sm font-semibold">{value}</p></div>; }
function Metric({ icon: Icon, label, value, tone }: { icon: typeof Truck; label: string; value: number; tone: "olive" | "red" | "amber" }) { return <Card><CardContent className="flex items-center gap-3 p-4"><Icon className={`h-5 w-5 ${tone === "red" ? "text-destructive" : tone === "amber" ? "text-amber-600" : "text-primary"}`} /><div><p className="text-2xl font-bold">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div></CardContent></Card>; }
function Empty({ text }: { text: string }) { return <p className="py-10 text-center text-sm text-muted-foreground">{text}</p>; }
