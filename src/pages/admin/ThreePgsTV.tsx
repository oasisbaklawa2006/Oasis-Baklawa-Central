import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Boxes, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { loadThreePgsCommandCentreSnapshotSafe } from "@/lib/threePgsSnapshotLoader";
import { buildThreePgsTvLanes } from "@/lib/threePgsSatelliteModel";
import { EMPTY_THREE_PGS_SNAPSHOT } from "./threePgsCommandCentreModel";

const REFRESH_MS = 30000;

export default function ThreePgsTV() {
  const [snapshot, setSnapshot] = useState(EMPTY_THREE_PGS_SNAPSHOT);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());

  const load = useCallback(async () => {
    const result = await loadThreePgsCommandCentreSnapshotSafe();
    setSnapshot(result.snapshot);
    setError(result.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const interval = setInterval(() => {
      void load();
      setNow(new Date());
    }, REFRESH_MS);
    return () => {
      clearInterval(interval);
    };
  }, [load]);

  const lanes = useMemo(() => buildThreePgsTvLanes(snapshot), [snapshot]);
  const topDemand = snapshot.demand.slice(0, 8);

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-white" data-testid="three-pgs-tv">
      <header className="mb-6 flex items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <Boxes className="h-8 w-8 text-amber-300" aria-hidden />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">3PGS Store Wall</h1>
            <p className="text-sm text-white/70">Read-only governed stock, demand and inbound status</p>
          </div>
        </div>
        <div className="text-right text-sm text-white/70">
          <p>{now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</p>
          <p>{error ? "Stale / error" : loading ? "Refreshing" : "Live"}</p>
        </div>
      </header>

      {error ? (
        <div className="mb-6 flex items-center gap-2 rounded-xl border border-red-400/40 bg-red-950/40 p-4 text-red-100">
          <AlertTriangle className="h-5 w-5" aria-hidden />
          {error}
        </div>
      ) : null}

      {loading && snapshot.demand.length === 0 ? (
        <div className="flex items-center gap-2 text-white/70">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          Loading governed 3PGS truth...
        </div>
      ) : (
        <>
          <div className="mb-8 grid gap-4 md:grid-cols-3 xl:grid-cols-6">
            {lanes.map((lane) => (
              <div key={lane.key} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <p className="text-4xl font-bold tabular-nums">{lane.value.toLocaleString("en-IN")}</p>
                <p className="mt-2 text-sm uppercase tracking-wide text-white/70">{lane.label}</p>
              </div>
            ))}
          </div>

          <section>
            <h2 className="mb-4 text-xl font-semibold">Top priority demand</h2>
            <div className="grid gap-3 xl:grid-cols-2">
              {topDemand.map((row) => (
                <div key={row.demand_id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div>
                    <p className="text-2xl font-semibold">{row.sku}</p>
                    <p className="text-sm text-white/70">{row.demand_reference}</p>
                  </div>
                  <div className="text-right">
                    <Badge className="mb-2 bg-amber-400 text-slate-950">#{row.priority_rank}</Badge>
                    <p className="text-3xl font-bold tabular-nums">{row.outstanding_qty}</p>
                    <p className="text-xs uppercase text-white/70">{row.demand_source_type}</p>
                  </div>
                </div>
              ))}
              {topDemand.length === 0 ? (
                <p className="text-white/70">No outstanding governed demand.</p>
              ) : null}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
