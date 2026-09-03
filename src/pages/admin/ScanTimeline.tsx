import { Link } from "react-router-dom";
import { AlertTriangle, Loader2, RefreshCw, ScanLine } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useScanTimeline } from "@/hooks/useScanTimeline";
import type { ScanAnomalyKind } from "@/lib/barcode/scanEventTypes";

const ANOMALY_KIND_REFERENCE: { kind: ScanAnomalyKind; description: string }[] = [
  { kind: "duplicate_scan", description: "Same barcode text seen more than once in the bounded window." },
  { kind: "out_of_order_scan", description: "Sequence regression for the same barcode text." },
  {
    kind: "dispatch_without_finance_release",
    description: "Dispatch-domain scan while finance release flag is false (requires per-order finance context).",
  },
  { kind: "carton_mismatch", description: "Reserved for when carton identity checks are wired to a feed." },
  { kind: "damaged_carton", description: "Reserved for damage attestations from operators or QC feeds." },
  { kind: "missing_barcode", description: "Empty or whitespace-only scan payload." },
];

function formatScanTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(date);
}

function statusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "verified") return "default";
  if (status === "mismatch" || status === "rejected" || status === "escalated") return "destructive";
  return "secondary";
}

/**
 * Scan timeline — read-only feed from operational_scan_records (barcode-scan-ingest + governed writes).
 */
export default function ScanTimeline() {
  const { rows, anomalies, loading, error, refresh } = useScanTimeline();
  const hasRows = rows.length > 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 pb-24">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <ScanLine className="h-7 w-7 text-primary" aria-hidden />
          <h1 className="text-xl font-bold tracking-tight">Scan timeline</h1>
          <Badge variant={hasRows ? "default" : "outline"} className="text-[10px] uppercase">
            {hasRows ? `Live · ${rows.length} rows` : "No scan rows yet"}
          </Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => void refresh()} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link to="/security-gate">Security gate</Link>
          </Button>
        </div>
      </header>

      {error && (
        <Card className="border-destructive/40">
          <CardContent className="flex items-center gap-2 p-4 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Could not read operational_scan_records: {error}
          </CardContent>
        </Card>
      )}

      {loading && !hasRows && !error && (
        <Card className="border-dashed">
          <CardContent className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading scan window…
          </CardContent>
        </Card>
      )}

      {!loading && !error && !hasRows && (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-base">No operational scan window</CardTitle>
            <CardDescription className="text-sm leading-relaxed">
              No rows in <code className="text-xs">operational_scan_records</code> yet. Verified scans from the
              barcode-scan-ingest edge function or governed gate flows will appear here — never fabricated events.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {hasRows && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent scans</CardTitle>
            <CardDescription className="text-xs">
              Bounded read-only window (newest first). Ingest authority: barcode-scan-ingest HMAC edge + governed
              Central writes.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Barcode</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Idempotency</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap text-xs">{formatScanTime(row.createdAt)}</TableCell>
                    <TableCell className="text-xs font-mono">{row.scanType}</TableCell>
                    <TableCell className="max-w-[180px] truncate font-mono text-xs" title={row.barcodeValue}>
                      {row.barcodeValue}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusBadgeVariant(row.verificationStatus)} className="text-[10px] uppercase">
                        {row.verificationStatus}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[140px] truncate text-xs text-muted-foreground" title={row.scanSource}>
                      {row.scanSource}
                    </TableCell>
                    <TableCell className="max-w-[120px] truncate font-mono text-[10px] text-muted-foreground">
                      {row.idempotencyKey ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {anomalies.length > 0 && (
        <Card className="border-amber-500/40">
          <CardHeader>
            <CardTitle className="text-sm">Derived anomalies</CardTitle>
            <CardDescription className="text-xs">
              Pure derivation from the loaded window — duplicate, ordering, and missing-payload checks only.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {anomalies.map((a) => (
              <div key={`${a.kind}:${a.relatedScanIds.join("-")}`} className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2">
                <p className="text-xs font-mono font-medium">{a.kind}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">{a.detail}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Anomaly kinds (reference)</CardTitle>
          <CardDescription className="text-xs">
            Categories the engine can derive from real scan rows supplied to this page.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {ANOMALY_KIND_REFERENCE.map(({ kind, description }) => (
            <div key={kind} className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
              <p className="text-xs font-mono font-medium text-foreground">{kind}</p>
              <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{description}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
