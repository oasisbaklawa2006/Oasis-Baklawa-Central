import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { loadThreePgsCommandCentreSnapshotSafe } from "@/lib/threePgsSnapshotLoader";
import { buildThreePgsMobileUrgentItems } from "@/lib/threePgsSatelliteModel";
import { THREE_PGS_OPERATOR_QUEUE_ANCHOR, EMPTY_THREE_PGS_SNAPSHOT } from "./threePgsCommandCentreModel";

export default function ThreePgsMobileUrgent() {
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

  const urgentItems = useMemo(() => buildThreePgsMobileUrgentItems(snapshot), [snapshot]);

  return (
    <div className="mx-auto max-w-lg space-y-4 p-4 pb-28" data-testid="three-pgs-mobile-urgent">
      <header className="space-y-2 border-b border-border pb-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold tracking-tight">3PGS urgent queue</h1>
            <p className="text-xs text-muted-foreground">Mobile operator subset over governed Core truth.</p>
          </div>
          <Button size="sm" variant="outline" className="min-h-12 min-w-12" onClick={() => { void load(); }} disabled={loading} aria-label="Refresh urgent queue">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
        <Button asChild className="min-h-12 w-full">
          <Link to={`/admin/3pgs-procurement-queue#${THREE_PGS_OPERATOR_QUEUE_ANCHOR}`}>
            Open full operator queue
            <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
          </Link>
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

      <div className="space-y-3">
        {urgentItems.map((item) => (
          <button
            key={item.id}
            type="button"
            className="w-full rounded-2xl border border-border bg-card p-4 text-left shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">{item.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{item.subtitle}</p>
              </div>
              <Badge variant="outline">{item.quantityLabel}</Badge>
            </div>
            {item.priorityRank !== undefined ? (
              <p className="mt-2 text-[11px] uppercase tracking-wide text-muted-foreground">Priority #{item.priorityRank}</p>
            ) : null}
          </button>
        ))}
        {!loading && urgentItems.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">No urgent 3PGS work right now.</p>
        ) : null}
      </div>
    </div>
  );
}
