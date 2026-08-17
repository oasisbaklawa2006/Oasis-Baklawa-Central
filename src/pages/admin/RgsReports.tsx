import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, RefreshCw, ScrollText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// Temporary typed boundary for `inventory_movements` pending regenerated
// project-wide Supabase definitions (matches the operationsDb pattern used
// elsewhere in the RGS surfaces).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const movementsDb = supabase as unknown as { from: (relation: string) => any };

type Movement = {
  id: string;
  movement_type: string;
  reservation_id: string | null;
  product_id: string;
  sku: string;
  quantity: number;
  source_location: string | null;
  destination_location: string | null;
  reason_code: string | null;
  correlation_id: string;
  created_at: string;
};

const movementTone: Record<string, "outline" | "destructive" | "default"> = {
  reservation_released: "destructive",
  reservation_expired: "destructive",
  stock_variance_recorded: "destructive",
  stock_quarantined: "destructive",
};

/**
 * RGS PC capability #18 (Reports / Audit): `inventory_movements` is Core's
 * append-only governed ledger -- this is the read-only reporting surface
 * over it. No write path here; every row is already immutable evidence
 * produced by the governed RPCs (reserve/pick/issue/release/etc).
 */
export default function RgsReports() {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [skuFilter, setSkuFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    let query = movementsDb
      .from("inventory_movements")
      .select("id, movement_type, reservation_id, product_id, sku, quantity, source_location, destination_location, reason_code, correlation_id, created_at")
      .order("created_at", { ascending: false })
      .limit(300);
    if (skuFilter.trim()) query = query.ilike("sku", `%${skuFilter.trim()}%`);
    const { data, error: loadError } = await query;
    if (loadError) {
      setError(loadError.message ?? "Unexpected audit ledger error");
      setMovements([]);
    } else {
      setMovements((data ?? []) as Movement[]);
    }
    setLoading(false);
  }, [skuFilter]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 pb-24">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">RGS Reports &amp; Audit</h1>
          <p className="text-xs text-muted-foreground">Append-only inventory movement ledger — every reservation, pick, issue and release, as it happened</p>
        </div>
        <div className="flex items-center gap-2">
          <Input placeholder="Filter by SKU" className="h-8 w-40 text-xs" value={skuFilter} onChange={(e) => setSkuFilter(e.target.value)} />
          <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh
          </Button>
        </div>
      </header>

      {error && <Card className="border-destructive/40"><CardContent className="flex items-center gap-2 p-4 text-sm text-destructive"><AlertTriangle className="h-4 w-4" />Ledger could not be read: {error}</CardContent></Card>}

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><ScrollText className="h-4 w-4 text-primary" />Movement ledger</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>When</TableHead><TableHead>Type</TableHead><TableHead>SKU</TableHead><TableHead className="text-right">Qty</TableHead><TableHead>From</TableHead><TableHead>To</TableHead><TableHead>Correlation</TableHead></TableRow></TableHeader>
            <TableBody>
              {movements.map((movement) => (
                <TableRow key={movement.id}>
                  <TableCell className="text-xs text-muted-foreground">{new Date(movement.created_at).toLocaleString("en-IN")}</TableCell>
                  <TableCell><Badge variant={movementTone[movement.movement_type] ?? "outline"} className="text-[10px] uppercase">{movement.movement_type.replace(/_/g, " ")}</Badge></TableCell>
                  <TableCell className="text-xs">{movement.sku}</TableCell>
                  <TableCell className="text-right">{Number(movement.quantity).toLocaleString("en-IN", { maximumFractionDigits: 3 })}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{movement.source_location ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{movement.destination_location ?? "—"}</TableCell>
                  <TableCell className="font-mono text-[10px] text-muted-foreground">{movement.correlation_id.slice(0, 12)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!loading && !movements.length && <p className="py-8 text-center text-sm text-muted-foreground">No movements match this filter.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
