import { useCallback, useEffect, useState, type ReactNode } from "react";
import { AlertTriangle, ArrowRight, Boxes, ClipboardCheck, Factory, PackageCheck, RefreshCw, Warehouse } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// The Phase 2 relations are live; generated Database types are reconciled in a
// separate schema-parity change. Keep this read boundary isolated until then.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fulfilmentDb = supabase as unknown as { from: (relation: string) => any };

type Store = { store_code: string; store_name: string; active: boolean };
type Availability = { sku: string; store_code: string; item_class: string; available_for_b2b_qty: number; reserved_qty: number; unavailable_qty: number };
type Receipt = { receipt_number: string; receipt_source: string; destination_store_code: string; status: string; created_at: string };
type Assembly = { assembly_job_number: string; output_sku: string; planned_qty: number; accepted_qty: number; status: string; created_at: string };

/** Live, read-only B2B fulfilment projection. Mutations belong to the dedicated store workflows. */
export default function InventoryCommandCenter() {
  const [stores, setStores] = useState<Store[]>([]);
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [assembly, setAssembly] = useState<Assembly[]>([]);
  const [metrics, setMetrics] = useState({ shortage: 0, openReceipts: 0, openAssembly: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    const results = await Promise.all([
      fulfilmentDb.from("b2b_inventory_stores").select("store_code, store_name, active").eq("active", true).order("store_code"),
      fulfilmentDb.from("b2b_order_availability").select("sku, store_code, item_class, available_for_b2b_qty, reserved_qty, unavailable_qty").order("updated_at", { ascending: false }).limit(100),
      fulfilmentDb.from("b2b_inventory_receipts").select("receipt_number, receipt_source, destination_store_code, status, created_at").order("created_at", { ascending: false }).limit(8),
      fulfilmentDb.from("b2b_assembly_jobs").select("assembly_job_number, output_sku, planned_qty, accepted_qty, status, created_at").order("created_at", { ascending: false }).limit(8),
      fulfilmentDb.from("b2b_order_availability").select("sku", { count: "exact", head: true }).lte("available_for_b2b_qty", 0),
      fulfilmentDb.from("b2b_inventory_receipts").select("id", { count: "exact", head: true }).not("status", "in", "(accepted,rejected,cancelled)"),
      fulfilmentDb.from("b2b_assembly_jobs").select("id", { count: "exact", head: true }).not("status", "in", "(accepted,rejected,cancelled)"),
    ]);
    const failed = results.find((r) => r.error)?.error;
    if (failed) setError(failed.message);
    setStores((results[0].data ?? []) as Store[]); setAvailability((results[1].data ?? []) as Availability[]);
    setReceipts((results[2].data ?? []) as Receipt[]); setAssembly((results[3].data ?? []) as Assembly[]); setLoading(false);
    setMetrics({ shortage: results[4].count ?? 0, openReceipts: results[5].count ?? 0, openAssembly: results[6].count ?? 0 });
  }, []);
  useEffect(() => { void load(); }, [load]);
  const { shortage, openReceipts, openAssembly } = metrics;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 pb-24">
      <header className="flex items-center justify-between gap-2 border-b border-border pb-4">
        <div className="flex items-center gap-2">
        <Warehouse className="h-7 w-7 text-primary" aria-hidden />
        <div><h1 className="text-xl font-bold tracking-tight">B2B fulfilment command center</h1><p className="text-xs text-muted-foreground">Live operational read model · customer-order fulfilment only</p></div>
        </div><div className="flex gap-2"><Button size="sm" variant="outline" asChild><Link to="/admin/inventory-receiving">Receiving <ArrowRight className="ml-2 h-4 w-4" /></Link></Button><Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh</Button></div>
      </header>
      {error && <Card className="border-destructive/40"><CardContent className="flex items-center gap-2 p-4 text-sm text-destructive"><AlertTriangle className="h-4 w-4" />Live contract could not be read: {error}</CardContent></Card>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric icon={Warehouse} label="Active stores" value={stores.length} tone="olive" />
        <Metric icon={AlertTriangle} label="Zero available lines" value={shortage} tone={shortage ? "red" : "olive"} />
        <Metric icon={ClipboardCheck} label="Open receipts" value={openReceipts} tone={openReceipts ? "amber" : "olive"} />
        <Metric icon={PackageCheck} label="Open assembly jobs" value={openAssembly} tone={openAssembly ? "amber" : "olive"} />
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Store lanes</CardTitle></CardHeader><CardContent><div className="grid gap-3 md:grid-cols-4">{stores.map((store) => <div key={store.store_code} className="rounded-lg border bg-muted/20 p-3"><div className="flex items-center gap-2"><Boxes className="h-4 w-4 text-primary" /><span className="font-semibold">{store.store_code}</span></div><p className="mt-1 text-xs text-muted-foreground">{store.store_name}</p></div>)}</div></CardContent>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <DataCard title="B2B availability" icon={Boxes}><Table><TableHeader><TableRow><TableHead>SKU</TableHead><TableHead>Store</TableHead><TableHead>Available</TableHead><TableHead>Reserved</TableHead></TableRow></TableHeader><TableBody>{availability.slice(0, 12).map((row) => <TableRow key={`${row.sku}-${row.store_code}`}><TableCell className="font-medium">{row.sku}</TableCell><TableCell>{row.store_code}</TableCell><TableCell><span className={Number(row.available_for_b2b_qty) <= 0 ? "font-bold text-destructive" : ""}>{row.available_for_b2b_qty}</span></TableCell><TableCell>{row.reserved_qty}</TableCell></TableRow>)}</TableBody></Table>{!availability.length && <Empty text="No B2B availability rows yet." />}</DataCard>
        <DataCard title="Receiving & assembly queue" icon={Factory}><div className="space-y-3">{receipts.slice(0, 4).map((row) => <QueueRow key={row.receipt_number} label={row.receipt_number} detail={`${row.receipt_source} → ${row.destination_store_code}`} status={row.status} />)}{assembly.slice(0, 4).map((row) => <QueueRow key={row.assembly_job_number} label={row.assembly_job_number} detail={`${row.output_sku} · ${row.accepted_qty}/${row.planned_qty} accepted`} status={row.status} />)}{!receipts.length && !assembly.length && <Empty text="No receiving or assembly activity yet." />}</div></DataCard>
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value, tone }: { icon: typeof Warehouse; label: string; value: number; tone: "olive" | "red" | "amber" }) {
  return <Card><CardContent className="flex items-center gap-3 p-4"><Icon className={`h-5 w-5 ${tone === "red" ? "text-destructive" : tone === "amber" ? "text-amber-600" : "text-primary"}`} /><div><p className="text-2xl font-bold">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div></CardContent></Card>;
}
function DataCard({ title, icon: Icon, children }: { title: string; icon: typeof Warehouse; children: ReactNode }) { return <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Icon className="h-4 w-4 text-primary" />{title}</CardTitle></CardHeader><CardContent>{children}</CardContent></Card>; }
function QueueRow({ label, detail, status }: { label: string; detail: string; status: string }) { return <div className="flex items-center justify-between gap-3 rounded-lg border p-3"><div><p className="text-sm font-medium">{label}</p><p className="text-xs text-muted-foreground">{detail}</p></div><Badge variant="outline" className="shrink-0 text-[10px] uppercase">{status.replace(/_/g, " ")}</Badge></div>; }
function Empty({ text }: { text: string }) { return <p className="py-8 text-center text-sm text-muted-foreground">{text}</p>; }
