import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  BarChart3,
  Download,
  Gauge,
  Landmark,
  Package,
  RefreshCw,
  ScanBarcode,
  Shield,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCurrency } from "@/hooks/useCurrency";
import { useManagementCommandCenter } from "@/hooks/useManagementCommandCenter";
import {
  appendExportHistory,
  exportTallyPeriodBatch,
  listExportHistory,
  type GovernedMetric,
  type MetricSemantics,
} from "@/lib/management-reporting";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

function SemanticsBadge({ semantics }: { semantics: MetricSemantics }) {
  const variant =
    semantics === "observed" ? "secondary" : semantics === "forecast" ? "outline" : "destructive";
  return (
    <Badge variant={variant} className="text-[10px] uppercase">
      {semantics}
    </Badge>
  );
}

function MetricCard({
  label,
  metric,
  formatValue,
}: {
  label: string;
  metric: GovernedMetric<number>;
  formatValue?: (n: number) => string;
}) {
  const display = formatValue ? formatValue(metric.value) : metric.value.toLocaleString("en-IN");
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="flex items-center justify-between gap-2 text-xs font-medium text-muted-foreground">
          <span>{label}</span>
          <SemanticsBadge semantics={metric.semantics} />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tabular-nums">{display}</p>
        <p className="mt-1 text-[10px] text-muted-foreground">{metric.source}</p>
        {metric.blocker ? (
          <p className="mt-1 text-[10px] text-amber-700">{metric.blocker}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default function ManagementCommandCenter() {
  const { format } = useCurrency();
  const {
    loading,
    error,
    projection,
    refresh,
    filters,
    setFilters,
    periodLabel,
    setPeriodPreset,
    canViewFinance,
    eanTotal,
    companyOptions,
  } = useManagementCommandCenter();
  const [exporting, setExporting] = useState(false);
  const [exportHistory, setExportHistory] = useState(() => listExportHistory());

  useEffect(() => {
    document.title = "Management Command Center";
  }, []);

  const criticalExceptions = useMemo(
    () => projection?.complianceExceptions.filter((e) => e.severity === "critical").length ?? 0,
    [projection],
  );

  const handleTallyExport = async () => {
    setExporting(true);
    try {
      const result = await exportTallyPeriodBatch(supabase, {
        periodStart: filters.periodStart,
        periodEnd: filters.periodEnd,
        companyId: filters.tallyCompanyId,
      });
      if (result.ok === false) {
        toast.error(result.error);
        return;
      }
      const blob = new Blob([result.combinedCsv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename;
      a.click();
      URL.revokeObjectURL(url);
      appendExportHistory(result.audit, result.filename);
      setExportHistory(listExportHistory());
      toast.success(
        `Exported ${result.lineCount} lines from ${result.orderCount} orders (hash ${result.audit.contentHash})`,
      );
      if (result.warnings.length > 0) {
        toast.message(`${result.warnings.length} export warning(s) — review before posting to Tally`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  if (!projection && loading) {
    return <p className="p-6 text-sm text-muted-foreground">Loading management command center…</p>;
  }

  const p = projection;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 pb-24">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <Gauge className="h-7 w-7 text-primary" aria-hidden />
          <h1 className="text-xl font-bold tracking-tight">Management Command Center</h1>
          <Badge variant="outline" className="text-[10px] uppercase">
            Governed reporting
          </Badge>
          {criticalExceptions > 0 ? (
            <Badge variant="destructive" className="text-[10px]">
              {criticalExceptions} critical compliance
            </Badge>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" asChild>
            <Link to="/admin/execution-command-center">Execution CMD</Link>
          </Button>
          <Button type="button" variant="outline" size="sm" asChild>
            <Link to="/admin/finance-governance">Finance governance</Link>
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => refresh()} disabled={loading}>
            <RefreshCw className={`mr-1 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden />
            Refresh
          </Button>
        </div>
      </header>

      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      {p?.finance255Blockers.length ? (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-amber-900">
              <Shield className="h-4 w-4" aria-hidden />
              Core Finance #255 — remaining unavailable macro metrics
            </CardTitle>
            <CardDescription className="text-xs text-amber-800">
              Production anchor {p.finance255ProductionAnchor.slice(0, 7)}… — read-only bindings active for{" "}
              {p.finance255AvailableContracts.join(", ")}. Metrics below remain fail-closed.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-1 pl-4 text-xs text-amber-900">
              {p.finance255Blockers.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
            {p.coreFinanceWarnings.length > 0 ? (
              <p className="mt-3 text-[10px] text-amber-800">
                Core read warnings: {p.coreFinanceWarnings.slice(0, 3).join(" · ")}
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="flex h-auto flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          {canViewFinance ? <TabsTrigger value="finance">Finance & Collections</TabsTrigger> : null}
          {canViewFinance ? <TabsTrigger value="tally">Tally Export</TabsTrigger> : null}
          <TabsTrigger value="compliance">EAN & Compliance</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {p ? (
            <>
              <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                <MetricCard label="Active orders" metric={p.operational.salesOrderCount} />
                <MetricCard label="Order value" metric={p.operational.salesOrderValue} formatValue={format} />
                <MetricCard label="In production" metric={p.operational.productionInFlight} />
                <MetricCard label="Packed / awaiting dispatch" metric={p.operational.packedAwaitingDispatch} />
                <MetricCard label="Dispatched" metric={p.operational.dispatchedCount} />
                <MetricCard label="Collections pending" metric={p.operational.collectionsPending} formatValue={format} />
              </section>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <TrendingUp className="h-4 w-4" aria-hidden />
                    Historical comparisons
                  </CardTitle>
                  <CardDescription className="text-xs">Same-day windows — observed order facts only</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Window</TableHead>
                        <TableHead className="text-right">Orders</TableHead>
                        <TableHead className="text-right">Value</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {p.operational.comparisons.map((c) => (
                        <TableRow key={c.window}>
                          <TableCell>{c.label}</TableCell>
                          <TableCell className="text-right tabular-nums">{c.orderCount}</TableCell>
                          <TableCell className="text-right tabular-nums">{format(c.orderValue)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <div className="grid gap-4 lg:grid-cols-3">
                {(
                  [
                    ["Best sellers", p.rankings.bestSellers, "units"],
                    ["Best clients", p.rankings.bestClients, "value"],
                    ["Best salespeople", p.rankings.bestSalespeople, "value"],
                  ] as const
                ).map(([title, items, kind]) => (
                  <Card key={title}>
                    <CardHeader>
                      <CardTitle className="text-sm">{title}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-xs">
                      {items.length === 0 ? (
                        <p className="text-muted-foreground">No ranked data in current scope</p>
                      ) : (
                        items.map((item, idx) => (
                          <Link
                            key={item.id}
                            to={item.drillRoute ?? "#"}
                            className="flex items-center justify-between rounded-md border border-border/60 px-2 py-1.5 hover:bg-muted/50"
                          >
                            <span className="truncate">
                              {idx + 1}. {item.label}
                            </span>
                            <span className="font-semibold tabular-nums">
                              {kind === "value" ? format(item.metric) : item.metric}
                            </span>
                          </Link>
                        ))
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden />
                    Delay / SLA / risk
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 text-xs">
                  {[
                    ["Finance holds", p.delayRisk.financeHoldCount, "/admin/finance-board"],
                    ["Awaiting final payment", p.delayRisk.awaitingFinalPaymentCount, "/admin/accounts-release"],
                    ["SLA breached (support)", p.delayRisk.slaBreachedSupportCount, "/admin/support"],
                    ["Dispatch bottleneck", p.delayRisk.dispatchBottleneckCount, "/admin/packing-dispatch"],
                    ["Open ledger disputes", p.delayRisk.disputedLedgerCount, "/admin/finance"],
                  ].map(([label, count, route]) => (
                    <Link
                      key={String(label)}
                      to={String(route)}
                      className="rounded-lg border border-border p-3 hover:bg-muted/40"
                    >
                      <p className="text-muted-foreground">{label}</p>
                      <p className="text-xl font-semibold tabular-nums">{count}</p>
                    </Link>
                  ))}
                </CardContent>
              </Card>
            </>
          ) : null}
        </TabsContent>

        {canViewFinance ? (
          <TabsContent value="finance" className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setPeriodPreset("this_month")}>
                This month
              </Button>
              <Button size="sm" variant="outline" onClick={() => setPeriodPreset("last_month")}>
                Last month
              </Button>
              <Button size="sm" variant="outline" onClick={() => setPeriodPreset("last_3_months")}>
                Last 3 months
              </Button>
              <Badge variant="secondary" className="text-[10px]">
                {periodLabel}
              </Badge>
            </div>

            {p?.collections ? (
              <>
                <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <MetricCard label="Recoverable outstanding" metric={p.collections.recoverableOutstanding} formatValue={format} />
                  <MetricCard label="Recovered in period" metric={p.collections.recoveredInPeriod} formatValue={format} />
                  <MetricCard label="Disputed / held" metric={p.collections.disputedOrHeld} formatValue={format} />
                  <MetricCard label="Wallet exposure" metric={p.collections.walletExposure} formatValue={format} />
                  <MetricCard label="Credit limit exposure" metric={p.collections.creditExposure} formatValue={format} />
                  <MetricCard label="Profitability" metric={p.collections.profitability} formatValue={format} />
                </section>

                <div className="grid gap-4 lg:grid-cols-3">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-sm">
                        <BarChart3 className="h-4 w-4" aria-hidden />
                        Ageing buckets
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Bucket (days)</TableHead>
                            <TableHead className="text-right">Orders</TableHead>
                            <TableHead className="text-right">Outstanding</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {p.collections.ageingBuckets.map((b) => (
                            <TableRow key={b.bucket}>
                              <TableCell>{b.bucket}</TableCell>
                              <TableCell className="text-right tabular-nums">{b.orderCount}</TableCell>
                              <TableCell className="text-right tabular-nums">
                                {format(b.outstandingAmount)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-sm">
                        <Landmark className="h-4 w-4" aria-hidden />
                        Top client exposure
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-xs">
                      {p.collections.topExposureClients.map((c) => (
                        <Link
                          key={c.id}
                          to={c.drillRoute ?? "#"}
                          className="flex justify-between rounded-md border border-border/60 px-2 py-1.5 hover:bg-muted/50"
                        >
                          <span className="truncate">{c.label}</span>
                          <span className="font-semibold tabular-nums">{format(c.metric)}</span>
                        </Link>
                      ))}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-sm">
                        <Shield className="h-4 w-4" aria-hidden />
                        Credit risk signals
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Observed from companies table — Core credit exposure per order via get_credit_exposure_facts_v1
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 gap-3 text-xs">
                      {[
                        ["Frozen accounts", p.collections.creditRisk.frozenAccountCount],
                        ["Negative wallet", p.collections.creditRisk.negativeWalletCount],
                        ["Credit enabled", p.collections.creditRisk.creditEnabledCount],
                        ["High exposure clients", p.collections.creditRisk.highExposureCount],
                      ].map(([label, count]) => (
                        <div key={String(label)} className="rounded-md border border-border/60 px-2 py-2">
                          <p className="text-muted-foreground">{label}</p>
                          <p className="text-lg font-semibold tabular-nums">{count}</p>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>
              </>
            ) : null}
          </TabsContent>
        ) : null}

        {canViewFinance ? (
          <TabsContent value="tally" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Download className="h-4 w-4" aria-hidden />
                  Deterministic Tally period export
                </CardTitle>
                <CardDescription className="text-xs">
                  Read-only batch export from canonical dispatch/packing facts. Period: {periodLabel}. Does not mutate
                  accounting records.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="min-w-[220px]">
                    <p className="mb-1 text-xs text-muted-foreground">Company filter (optional)</p>
                    <Select
                      value={filters.tallyCompanyId ?? "all"}
                      onValueChange={(value) =>
                        setFilters((f) => ({
                          ...f,
                          tallyCompanyId: value === "all" ? null : value,
                        }))
                      }
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="All companies" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All companies</SelectItem>
                        {companyOptions.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={() => void handleTallyExport()} disabled={exporting}>
                    {exporting ? "Exporting…" : "Generate & download CSV"}
                  </Button>
                </div>
                {exportHistory.length > 0 ? (
                  <div>
                    <p className="mb-2 text-xs font-medium text-muted-foreground">Export evidence history</p>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>When</TableHead>
                          <TableHead>Orders</TableHead>
                          <TableHead>Lines</TableHead>
                          <TableHead>Hash</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {exportHistory.slice(0, 8).map((r) => (
                          <TableRow key={r.exportId}>
                            <TableCell className="text-xs">{new Date(r.storedAtIso).toLocaleString()}</TableCell>
                            <TableCell>{r.orderCount}</TableCell>
                            <TableCell>{r.lineCount}</TableCell>
                            <TableCell className="font-mono text-[10px]">{r.contentHash}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No export history yet on this device.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ) : null}

        <TabsContent value="compliance" className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="Search EAN, SKU, product name…"
              value={filters.eanSearch}
              onChange={(e) => setFilters((f) => ({ ...f, eanSearch: e.target.value, eanPage: 0 }))}
              className="max-w-sm"
            />
            <Badge variant="outline" className="text-[10px]">
              {p?.complianceExceptions.length ?? 0} exceptions
            </Badge>
            <Badge variant="secondary" className="text-[10px]">
              {eanTotal} registry rows
            </Badge>
            <div className="ml-auto flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={filters.eanPage <= 0 || loading}
                onClick={() => setFilters((f) => ({ ...f, eanPage: Math.max(0, f.eanPage - 1) }))}
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={
                  loading ||
                  (projection?.eanRegistry.length ?? 0) < filters.eanPageSize ||
                  (filters.eanPage + 1) * filters.eanPageSize >= eanTotal
                }
                onClick={() => setFilters((f) => ({ ...f, eanPage: f.eanPage + 1 }))}
              >
                Next
              </Button>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <ScanBarcode className="h-4 w-4" aria-hidden />
                  EAN registry
                </CardTitle>
                <CardDescription className="text-xs">
                  Canonical source: products.barcode_sku — duplicate prevention visibility only
                </CardDescription>
              </CardHeader>
              <CardContent className="max-h-80 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>EAN</TableHead>
                      <TableHead>Score</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(p?.eanRegistry ?? []).map((e) => (
                      <TableRow key={e.productId}>
                        <TableCell className="max-w-[140px] truncate text-xs">
                          <Link to={e.drillRoute} className="hover:underline">
                            {e.productName}
                          </Link>
                          {e.isDuplicate ? (
                            <Badge variant="destructive" className="ml-1 text-[9px]">
                              DUP
                            </Badge>
                          ) : null}
                        </TableCell>
                        <TableCell className="font-mono text-[10px]">{e.ean ?? "—"}</TableCell>
                        <TableCell className="tabular-nums">{e.complianceScore}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Package className="h-4 w-4" aria-hidden />
                  Management exception queue
                </CardTitle>
                <CardDescription className="text-xs">
                  FSSAI / legal label / HSN-GST / EAN readiness — no invented approvals
                </CardDescription>
              </CardHeader>
              <CardContent className="max-h-80 space-y-2 overflow-y-auto text-xs">
                {(p?.complianceExceptions ?? []).slice(0, 40).map((ex) => (
                  <Link
                    key={ex.id}
                    to={ex.drillRoute}
                    className="flex items-start justify-between gap-2 rounded-md border border-border/60 px-2 py-1.5 hover:bg-muted/50"
                  >
                    <div>
                      <p className="font-medium">{ex.entityLabel}</p>
                      <p className="text-muted-foreground">{ex.message}</p>
                    </div>
                    <Badge
                      variant={ex.severity === "critical" ? "destructive" : ex.severity === "high" ? "default" : "secondary"}
                      className="shrink-0 text-[9px] uppercase"
                    >
                      {ex.category}
                    </Badge>
                  </Link>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
