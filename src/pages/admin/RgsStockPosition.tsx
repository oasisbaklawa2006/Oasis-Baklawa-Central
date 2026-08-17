import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Boxes, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

// Temporary typed boundary for `inventory_stock_balances` pending
// regenerated project-wide Supabase definitions.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const balancesDb = supabase as unknown as { from: (relation: string) => any };

type Balance = {
  id: string;
  product_id: string;
  sku: string;
  location_code: string;
  available_qty: number;
  reserved_qty: number;
  picked_qty: number;
  damaged_qty: number;
  expired_qty: number;
  quarantine_qty: number;
  version: number;
  updated_at: string;
};

/**
 * RGS PC capabilities #11 (Ready Stock) and #12 (Product Stock Detail): the
 * live, governed stock-on-hand ledger `inventory_stock_balances` had no
 * dedicated position screen -- this is the thin read-only view over it, with
 * SKU search doubling as the per-product drill-down (selecting a row shows
 * its full bucket breakdown).
 */
export default function RgsStockPosition() {
  const [balances, setBalances] = useState<Balance[]>([]);
  const [skuFilter, setSkuFilter] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: loadError } = await balancesDb
      .from("inventory_stock_balances")
      .select("id, product_id, sku, location_code, available_qty, reserved_qty, picked_qty, damaged_qty, expired_qty, quarantine_qty, version, updated_at")
      .order("sku", { ascending: true })
      .limit(1000);
    if (loadError) {
      setError(loadError.message ?? "Unexpected stock position error");
      setBalances([]);
    } else {
      const rows = (data ?? []) as Balance[];
      setBalances(rows);
      setSelectedId((current) => current && rows.some((row) => row.id === current) ? current : rows[0]?.id ?? null);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const needle = skuFilter.trim().toLowerCase();
    return needle ? balances.filter((row) => row.sku.toLowerCase().includes(needle)) : balances;
  }, [balances, skuFilter]);
  const selected = balances.find((row) => row.id === selectedId) ?? null;
  const totalAvailable = filtered.reduce((sum, row) => sum + Number(row.available_qty), 0);
  const totalReserved = filtered.reduce((sum, row) => sum + Number(row.reserved_qty), 0);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 pb-24">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">RGS Ready Stock</h1>
          <p className="text-xs text-muted-foreground">Live governed stock-on-hand position across every RGS location</p>
        </div>
        <div className="flex items-center gap-2">
          <Input placeholder="Filter by SKU" className="h-8 w-40 text-xs" value={skuFilter} onChange={(e) => setSkuFilter(e.target.value)} />
          <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh
          </Button>
        </div>
      </header>

      {error && <Card className="border-destructive/40"><CardContent className="flex items-center gap-2 p-4 text-sm text-destructive"><AlertTriangle className="h-4 w-4" />Stock balances could not be read: {error}</CardContent></Card>}

      <div className="grid gap-3 sm:grid-cols-2">
        <Card><CardContent className="flex items-center gap-3 p-4"><Boxes className="h-5 w-5 text-primary" /><div><p className="text-2xl font-bold">{fmt(totalAvailable)}</p><p className="text-xs text-muted-foreground">Total available</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4"><Boxes className="h-5 w-5 text-amber-600" /><div><p className="text-2xl font-bold">{fmt(totalReserved)}</p><p className="text-xs text-muted-foreground">Total reserved</p></div></CardContent></Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.2fr)]">
        <Card>
          <CardHeader><CardTitle className="text-base">Stock by SKU</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {filtered.map((row) => (
              <button key={row.id} type="button" onClick={() => setSelectedId(row.id)}
                className={`w-full rounded-lg border p-3 text-left transition-colors ${selectedId === row.id ? "border-primary bg-primary/5" : "hover:bg-muted/40"}`}>
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-semibold">{row.sku}</p>
                  <Badge variant="outline">{row.location_code}</Badge>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">{fmt(row.available_qty)} available · {fmt(row.reserved_qty)} reserved</p>
              </button>
            ))}
            {!loading && !filtered.length && <p className="py-8 text-center text-sm text-muted-foreground">No stock balances match this filter.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Product stock detail</CardTitle></CardHeader>
          <CardContent>
            {selected ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Detail label="SKU" value={selected.sku} />
                <Detail label="Location" value={selected.location_code} />
                <Detail label="Available" value={fmt(selected.available_qty)} />
                <Detail label="Reserved" value={fmt(selected.reserved_qty)} />
                <Detail label="Picked" value={fmt(selected.picked_qty)} />
                <Detail label="Damaged" value={fmt(selected.damaged_qty)} />
                <Detail label="Expired" value={fmt(selected.expired_qty)} />
                <Detail label="Quarantined" value={fmt(selected.quarantine_qty)} />
                <Detail label="Version" value={String(selected.version)} />
                <Detail label="Last updated" value={new Date(selected.updated_at).toLocaleString("en-IN")} />
              </div>
            ) : <p className="py-8 text-center text-sm text-muted-foreground">Select a SKU to see its full bucket breakdown.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function fmt(value: number) { return Number(value).toLocaleString("en-IN", { maximumFractionDigits: 3 }); }
function Detail({ label, value }: { label: string; value: string }) { return <div><p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 text-sm font-semibold">{value}</p></div>; }
