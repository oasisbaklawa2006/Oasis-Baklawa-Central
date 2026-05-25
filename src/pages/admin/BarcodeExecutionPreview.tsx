import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ScanLine, RefreshCw, ShieldAlert, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useBarcodeExecution } from "@/hooks/useBarcodeExecution";

/**
 * Internal barcode execution preview — no dispatch completion, no stock mutation.
 * Route: /admin/barcode-execution-preview
 */
export default function BarcodeExecutionPreview() {
  const { loading, error, scans, mismatchAlerts, duplicateAlerts, canWrite, refresh, runVerifySample } =
    useBarcodeExecution();

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 pb-24">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <ScanLine className="h-7 w-7 text-primary" aria-hidden />
          <h1 className="text-xl font-bold tracking-tight">Barcode execution preview</h1>
          <Badge variant="outline" className="text-[10px] uppercase">
            Append-only scans
          </Badge>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
          <RefreshCw className={`mr-1 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden />
          Refresh
        </Button>
      </header>

      <Card className="border-amber-500/40 bg-amber-500/5">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm text-amber-900 dark:text-amber-100">
            <ShieldAlert className="h-4 w-4" aria-hidden />
            Physical execution traceability only
          </CardTitle>
          <CardDescription className="text-xs">
            Scans are immutable audit evidence. No stock deduction, dispatch completion, or customer exposure.{" "}
            <Link to="/admin/queue-execution-preview" className="underline">
              Queue execution
            </Link>{" "}
            handles lifecycle actions separately.
          </CardDescription>
        </CardHeader>
        {canWrite ? (
          <CardContent>
            <Button size="sm" variant="secondary" disabled={loading} onClick={() => void runVerifySample()}>
              Record sample order scan
            </Button>
          </CardContent>
        ) : (
          <CardContent className="text-xs text-muted-foreground">Read-only for your role.</CardContent>
        )}
      </Card>

      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      {(mismatchAlerts.length > 0 || duplicateAlerts.length > 0) && (
        <Card className="border-destructive/30">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-destructive" aria-hidden />
              Alerts
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-xs">
            <p>Mismatches / rejected: {mismatchAlerts.length}</p>
            <p>Duplicates: {duplicateAlerts.length}</p>
          </CardContent>
        </Card>
      )}

      <ul className="space-y-3">
        {scans.map((scan) => (
          <li key={scan.id}>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">
                  {scan.scanType} · {scan.verificationStatus}
                </CardTitle>
                <CardDescription className="text-xs">
                  {scan.barcodeValue}
                  {scan.expectedBarcode ? ` → expected ${scan.expectedBarcode}` : null}
                  {scan.mismatchReason ? ` — ${scan.mismatchReason}` : null}
                </CardDescription>
              </CardHeader>
              <CardContent className="text-[10px] text-muted-foreground">
                {scan.entityType}/{scan.entityId.slice(0, 8)}… · {new Date(scan.createdAt).toLocaleString()}
              </CardContent>
            </Card>
          </li>
        ))}
        {!loading && scans.length === 0 ? (
          <p className="text-sm text-muted-foreground">No scan records yet.</p>
        ) : null}
      </ul>
    </div>
  );
}
