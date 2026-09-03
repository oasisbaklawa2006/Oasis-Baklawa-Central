import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Boxes, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { resolveThreePgsSatelliteAudience } from "@/lib/threePgsAccess";
import { loadThreePgsCommandCentreSnapshotSafe } from "@/lib/threePgsSnapshotLoader";
import { projectThreePgsSatellite } from "@/lib/threePgsSatelliteModel";
import { EMPTY_THREE_PGS_SNAPSHOT } from "./threePgsCommandCentreModel";

export default function ThreePgsSatelliteVisibility() {
  const { role } = useAuth();
  const audience = resolveThreePgsSatelliteAudience(role);
  const [snapshot, setSnapshot] = useState(EMPTY_THREE_PGS_SNAPSHOT);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await loadThreePgsCommandCentreSnapshotSafe();
    setSnapshot(result.snapshot);
    setError(result.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const projection = useMemo(
    () => (audience ? projectThreePgsSatellite(snapshot, audience) : null),
    [audience, snapshot],
  );

  if (!audience || !projection) {
    return (
      <div className="mx-auto max-w-3xl p-4">
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">
            This read-only 3PGS satellite is not available for your role.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 pb-24" data-testid="three-pgs-satellite-visibility">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Boxes className="h-5 w-5 text-primary" aria-hidden />
            <h1 className="text-lg font-bold tracking-tight">{projection.label}</h1>
            <Badge variant="outline">R4.6 read-only</Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{projection.description}</p>
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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Metric label="Available" value={projection.metrics.available} />
        <Metric label="Reserved" value={projection.metrics.reserved} />
        <Metric label="Open P&A" value={projection.metrics.openAssembly} />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Priority demand</CardTitle>
          <CardDescription className="text-xs">Role-filtered projection from governed Core truth.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {projection.demand.map((row) => (
            <div key={row.demand_id} className="flex items-center justify-between rounded-lg border p-3 text-xs">
              <div>
                <p className="font-medium">{row.sku}</p>
                <p className="text-muted-foreground">{row.demand_reference}</p>
              </div>
              <div className="text-right">
                <Badge variant="secondary">#{row.priority_rank}</Badge>
                <p className="mt-1">{row.outstanding_qty} outstanding</p>
              </div>
            </div>
          ))}
          {!loading && projection.demand.length === 0 ? (
            <p className="text-sm text-muted-foreground">No matching demand for this satellite view.</p>
          ) : null}
        </CardContent>
      </Card>

      {projection.assembly.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Open P&amp;A requirements</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {projection.assembly.map((row) => (
              <div key={row.id} className="flex items-center justify-between rounded-lg border p-3 text-xs">
                <div>
                  <p className="font-medium">{row.sku}</p>
                  <p className="text-muted-foreground">{row.requirement_number}</p>
                </div>
                <Badge variant="outline">{row.status.replace(/_/g, " ")}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xl font-bold">{value.toLocaleString("en-IN")}</p>
        <p className="text-[11px] text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}
