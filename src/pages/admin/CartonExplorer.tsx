import { Link } from "react-router-dom";
import { AlertTriangle, Box, CheckCircle2, Loader2, RefreshCw, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCartonExplorer } from "@/hooks/useCartonExplorer";
import { deriveCurrentDplVersion, LOCKED_CARTON_STATUSES } from "@/lib/packing-carton-dpl";
import { B2B_DISPATCH_MANAGEMENT_ROUTE } from "@/lib/dispatch-finalization/legacyDispatchGuard";

/**
 * Carton explorer — read-only traceability over governed b2b_dispatch_* carton/DPL truth.
 * Mutations belong exclusively to DispatchManagement (FACT-C3 Core RPC chain).
 */
export default function CartonExplorer() {
  const {
    consignments,
    selectedConsignmentId,
    setSelectedConsignmentId,
    detail,
    loading,
    detailLoading,
    error,
    refresh,
  } = useCartonExplorer();

  const currentDpl = detail ? deriveCurrentDplVersion(detail.dplVersions) : null;
  const hasConsignments = consignments.length > 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 pb-24">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <Box className="h-7 w-7 text-primary" aria-hidden />
          <h1 className="text-xl font-bold tracking-tight">Carton explorer</h1>
          <Badge variant={hasConsignments ? "default" : "outline"} className="text-[10px] uppercase">
            {hasConsignments ? `Live · ${consignments.length} consignments` : "No consignments yet"}
          </Badge>
          <Badge variant="secondary" className="text-[10px] uppercase">Read-only</Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => void refresh()} disabled={loading || detailLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading || detailLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link to={B2B_DISPATCH_MANAGEMENT_ROUTE}>Dispatch Management</Link>
          </Button>
        </div>
      </header>

      <p className="text-xs text-muted-foreground">
        Governed carton and DPL truth from <code className="text-xs">b2b_dispatch_*</code> Core authority — never
        client-composed. Open, scan, evidence, lock and DPL mutations run only on Dispatch Management.
      </p>

      {error && (
        <Card className="border-destructive/40">
          <CardContent className="flex items-center gap-2 p-4 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </CardContent>
        </Card>
      )}

      {loading && !hasConsignments && !error && (
        <Card className="border-dashed">
          <CardContent className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading governed consignments…
          </CardContent>
        </Card>
      )}

      {!loading && !error && !hasConsignments && (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-base">No governed consignments</CardTitle>
            <CardDescription className="text-sm">
              Cartons appear here after consignment creation via Dispatch Management — no fabricated carton rows.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {hasConsignments && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Consignment</CardTitle>
            <CardDescription className="text-xs">Select a consignment to inspect cartons, quantities and DPL versions.</CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={selectedConsignmentId} onValueChange={setSelectedConsignmentId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a consignment" />
              </SelectTrigger>
              <SelectContent>
                {consignments.map((row) => (
                  <SelectItem key={row.consignment_id} value={row.consignment_id}>
                    {row.consignment_number} · {row.order_number} ({row.carton_count} cartons)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      {selectedConsignmentId && detailLoading && (
        <Card className="border-dashed">
          <CardContent className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading carton detail…
          </CardContent>
        </Card>
      )}

      {selectedConsignmentId && detail && !detailLoading && (
        <>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Packing contracts</CardTitle>
              <CardDescription className="text-xs">
                Deterministic checks — fail closed on duplicate cartons, quantity mismatch or stale DPL chain.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <ContractRow label="Carton uniqueness" ok={detail.contracts.uniqueness.ok} />
              <ContractRow label="Quantity conservation" ok={detail.contracts.quantity.ok} />
              <ContractRow label="DPL version chain" ok={detail.contracts.dplChain.ok} />
              <ContractRow
                label="Finance handoff"
                ok={detail.contracts.financeHandoff.eligible}
                detail={
                  detail.contracts.financeHandoff.eligible
                    ? "Ready for submit_to_finance"
                    : detail.contracts.financeHandoff.blockers.join("; ")
                }
              />
              {detail.contracts.partial.isPartial && (
                <p className="text-[11px] text-amber-700">
                  Partial packing: {detail.contracts.partial.unresolvedLineIds.length} line(s) packed below accepted-ready qty.
                </p>
              )}
              {!detail.contracts.allOk && (
                <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-2 text-[11px] text-destructive">
                  <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    {[
                      ...detail.contracts.uniqueness.violations,
                      ...detail.contracts.quantity.violations,
                      ...detail.contracts.dplChain.violations,
                    ]
                      .map((v) => v.message)
                      .join(" · ")}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Cartons ({detail.cartons.length})</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {detail.cartons.length === 0 ? (
                <p className="text-xs text-muted-foreground">No cartons opened for this consignment yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Evidence</TableHead>
                      <TableHead>Version</TableHead>
                      <TableHead>Items</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.cartons.map((carton) => {
                      const itemCount = detail.cartonItems.filter((i) => i.carton_id === carton.id).length;
                      const hasEvidence =
                        Boolean(carton.open_photo_ref?.trim()) ||
                        (carton.net_weight ?? 0) > 0 ||
                        (carton.gross_weight ?? 0) > 0;
                      return (
                        <TableRow key={carton.id}>
                          <TableCell className="font-mono text-xs">{carton.carton_code}</TableCell>
                          <TableCell>
                            <Badge variant={LOCKED_CARTON_STATUSES.has(carton.status) ? "default" : "outline"}>
                              {carton.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs">{hasEvidence ? "Bound" : "Missing"}</TableCell>
                          <TableCell className="text-xs">v{carton.current_version}</TableCell>
                          <TableCell className="text-xs">{itemCount}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {currentDpl && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Current DPL</CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-1">
                <p>Version {currentDpl.version_number} · {currentDpl.status}</p>
                <p className="text-muted-foreground">
                  Finance: {currentDpl.finance_check_state}
                  {currentDpl.submitted_to_finance_at
                    ? ` · submitted ${new Date(currentDpl.submitted_to_finance_at).toLocaleString()}`
                    : ""}
                </p>
              </CardContent>
            </Card>
          )}

          {detail.lines.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Line reconciliation</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU</TableHead>
                      <TableHead>Accepted</TableHead>
                      <TableHead>Packed (auth)</TableHead>
                      <TableHead>Scanned in cartons</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.lines.map((line) => {
                      const scanned = detail.cartonItems
                        .filter((i) => i.consignment_line_id === line.id)
                        .reduce((s, i) => s + i.quantity, 0);
                      const mismatch = scanned > line.packed_qty || (line.packed_qty > 0 && scanned === 0);
                      return (
                        <TableRow key={line.id}>
                          <TableCell className="font-mono text-xs">{line.product_code}</TableCell>
                          <TableCell className="text-xs">{line.accepted_ready_qty}</TableCell>
                          <TableCell className="text-xs">{line.packed_qty}</TableCell>
                          <TableCell className={`text-xs ${mismatch ? "text-destructive font-medium" : ""}`}>{scanned}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function ContractRow({ label, ok, detail }: { label: string; ok: boolean; detail?: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      {ok ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
      ) : (
        <AlertTriangle className="h-3.5 w-3.5 text-amber-600" aria-hidden />
      )}
      <span className="font-medium">{label}</span>
      <span className="text-muted-foreground">{detail ?? (ok ? "OK" : "Check required")}</span>
    </div>
  );
}
