import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// Temporary typed boundary for `rgs_day_close_exceptions` (oasis-supabase-core
// 20260817100000) pending regenerated project-wide Supabase definitions.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const dayCloseDb = supabase as unknown as { from: (relation: string) => any };

type ExceptionRow = {
  exception_type: string;
  reference_id: string;
  related_job_id: string | null;
  related_reservation_id: string | null;
  location_code: string | null;
  quantity: number;
  opened_at: string | null;
};

const exceptionLabels: Record<string, string> = {
  unaccepted_transfer: "Unaccepted Production→RGS transfer",
  ready_not_dispatched: "Job ready but not dispatched to RGS",
  unacknowledged_issue: "Issued stock not yet handover-acknowledged",
  open_reservation_no_stock: "Open reservation with unresolved shortage",
};

/**
 * RGS PC capability #16 (Day Closing): a day-close never silently closes an
 * exception -- it only exposes what remains open, read from Core's
 * `rgs_day_close_exceptions` view. Resolving an exception happens through
 * the same governed actions already wired in ReadyGoodsStore.tsx (receive,
 * accept, pick, issue, acknowledge) -- this screen is the read-only roll-up
 * that tells a closer what is still outstanding, grouped by type so nothing
 * is missed at end of day.
 */
export default function RgsDayClose() {
  const [rows, setRows] = useState<ExceptionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: loadError } = await dayCloseDb
      .from("rgs_day_close_exceptions")
      .select("exception_type, reference_id, related_job_id, related_reservation_id, location_code, quantity, opened_at")
      .order("opened_at", { ascending: true });
    if (loadError) {
      setError(loadError.message ?? "Unexpected day-close error");
      setRows([]);
    } else {
      setRows((data ?? []) as ExceptionRow[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const grouped = useMemo(() => {
    const byType = new Map<string, ExceptionRow[]>();
    for (const row of rows) {
      const list = byType.get(row.exception_type) ?? [];
      list.push(row);
      byType.set(row.exception_type, list);
    }
    return byType;
  }, [rows]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 pb-24">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">RGS Day Closing</h1>
          <p className="text-xs text-muted-foreground">Everything a day-close must resolve or explicitly carry forward — never auto-closed</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh
        </Button>
      </header>

      {error && <Card className="border-destructive/40"><CardContent className="flex items-center gap-2 p-4 text-sm text-destructive"><AlertTriangle className="h-4 w-4" />Exceptions could not be read: {error}</CardContent></Card>}

      {!loading && !error && !rows.length && (
        <Card className="border-emerald-200 bg-emerald-50/40">
          <CardContent className="flex items-center gap-3 p-6 text-sm">
            <CheckCircle2 className="h-5 w-5 text-emerald-700" />
            <div><p className="font-semibold">No open exceptions</p><p className="text-muted-foreground">Every transfer, job, issue and reservation is resolved. The day can close clean.</p></div>
          </CardContent>
        </Card>
      )}

      {Array.from(grouped.entries()).map(([type, typeRows]) => (
        <Card key={type}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              <span>{exceptionLabels[type] ?? type}</span>
              <Badge variant="destructive">{typeRows.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Reference</TableHead><TableHead>Location</TableHead><TableHead className="text-right">Quantity</TableHead><TableHead>Opened</TableHead></TableRow></TableHeader>
              <TableBody>
                {typeRows.map((row) => (
                  <TableRow key={row.reference_id}>
                    <TableCell className="font-mono text-xs">{row.reference_id.slice(0, 8).toUpperCase()}</TableCell>
                    <TableCell>{row.location_code ?? "—"}</TableCell>
                    <TableCell className="text-right">{Number(row.quantity).toLocaleString("en-IN", { maximumFractionDigits: 3 })}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{row.opened_at ? new Date(row.opened_at).toLocaleString("en-IN") : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
