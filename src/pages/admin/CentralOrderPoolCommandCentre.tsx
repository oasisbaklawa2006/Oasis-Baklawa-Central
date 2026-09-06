import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ClipboardList, Inbox, Loader2, PackageCheck, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  CENTRAL_ORDER_POOL_CANONICAL_ROUTE,
  CENTRAL_ORDER_POOL_ROUTE_CENSUS,
} from "@/lib/centralOrderPool/centralOrderPoolRouteCensus";
import {
  visibleCentralOrderPoolLenses,
  type CentralOrderPoolLens,
} from "@/lib/centralOrderPool/centralOrderPoolAccess";
import {
  EMPTY_CENTRAL_ORDER_POOL_SNAPSHOT,
  centralOrderPoolMetrics,
} from "@/lib/centralOrderPool/centralOrderPoolModel";
import {
  applyCentralOrderPoolSnapshotLoadResult,
  loadCentralOrderPoolSnapshot,
} from "@/lib/centralOrderPool/centralOrderPoolSnapshotLoader";
import { useAuth } from "@/hooks/useAuth";
import { formatSalesOrderLabel } from "@/utils/orderSoLabel";

function lensMetric(
  lens: CentralOrderPoolLens,
  metrics: ReturnType<typeof centralOrderPoolMetrics>,
): number | null {
  switch (lens.key) {
    case "intake":
      return metrics.intakeOpen;
    case "pipeline":
      return metrics.pipelineOpen;
    case "production":
      return metrics.productionOpen;
    case "packing":
      return metrics.packingOpen;
    default:
      return null;
  }
}

export default function CentralOrderPoolCommandCentre() {
  const { role } = useAuth();
  const lenses = useMemo(() => visibleCentralOrderPoolLenses(role), [role]);
  const [snapshot, setSnapshot] = useState(EMPTY_CENTRAL_ORDER_POOL_SNAPSHOT);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await loadCentralOrderPoolSnapshot();
    setSnapshot((previous) => applyCentralOrderPoolSnapshotLoadResult(previous, result));
    setError(result.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const metrics = useMemo(() => centralOrderPoolMetrics(snapshot), [snapshot]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 pb-24">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Inbox className="h-6 w-6 text-primary" aria-hidden />
            <h1 className="text-xl font-bold tracking-tight">Central Order Pool</h1>
            <Badge variant="outline">POINT71 governed composition</Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            One operational authority over intake, pipeline and execution lenses. Read-only here; mutations stay on governed deep links.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => { void load(); }} disabled={loading}>
          <RefreshCw className={`mr-1 h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden />
          Refresh
        </Button>
      </header>

      {error ? (
        <Card className="border-destructive/40">
          <CardContent className="flex items-center gap-2 p-4 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4" aria-hidden />
            {error}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric icon={<Inbox className="h-4 w-4" />} label="Intake open" value={metrics.intakeOpen} />
        <Metric icon={<ClipboardList className="h-4 w-4" />} label="Pipeline open" value={metrics.pipelineOpen} />
        <Metric icon={<PackageCheck className="h-4 w-4" />} label="Production active" value={metrics.productionOpen} />
        <Metric icon={<PackageCheck className="h-4 w-4" />} label="Packing active" value={metrics.packingOpen} />
      </div>

      <section aria-labelledby="cop-lenses-heading" className="space-y-3">
        <div>
          <h2 id="cop-lenses-heading" className="text-sm font-semibold">Role-scoped execution lenses</h2>
          <p className="text-xs text-muted-foreground">
            Canonical route {CENTRAL_ORDER_POOL_CANONICAL_ROUTE}. Each lens opens the governed surface for that workstream.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {lenses.map((lens) => {
            const count = lensMetric(lens, metrics);
            return (
              <Card key={lens.key}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between text-sm">
                    <span>{lens.label}</span>
                    {count !== null ? (
                      <Badge variant="secondary" className="tabular-nums">
                        {count}
                      </Badge>
                    ) : null}
                  </CardTitle>
                  <CardDescription className="text-xs">{lens.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild size="sm" variant="outline" className="w-full">
                    <Link to={lens.route}>Open governed surface</Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {lenses.some((lens) => lens.key === "pipeline" || lens.key === "production" || lens.key === "packing") ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Recent orders</CardTitle>
            <CardDescription className="text-xs">
              Read-only projection from governed `orders` rows. Status changes belong on Order Management.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {loading ? (
              <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Loading recent orders…
              </div>
            ) : snapshot.recentOrders.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">No active orders in the projection.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reference</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {snapshot.recentOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell>{formatSalesOrderLabel(order)}</TableCell>
                      <TableCell>{order.company_name ?? "—"}</TableCell>
                      <TableCell className="uppercase text-xs">{order.status}</TableCell>
                      <TableCell className="text-right">
                        <Button asChild size="sm" variant="ghost">
                          <Link to="/admin/order-management">Open pipeline</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ) : null}

      <details className="rounded-lg border border-border bg-muted/20 p-4 text-xs text-muted-foreground">
        <summary className="cursor-pointer font-medium text-foreground">Route / authority census</summary>
        <ul className="mt-3 space-y-2">
          {CENTRAL_ORDER_POOL_ROUTE_CENSUS.map((entry) => (
            <li key={entry.path}>
              <code className="text-foreground">{entry.path}</code>
              {" — "}
              <span className="uppercase">{entry.disposition}</span>
              {" → "}
              {entry.authority}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="rounded-md bg-primary/10 p-2 text-primary">{icon}</div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold tabular-nums">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
