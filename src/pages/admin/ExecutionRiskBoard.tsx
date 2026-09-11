import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useExecutionCommandCenter } from "@/hooks/useExecutionCommandCenter";

/** Focused risk view — /admin/execution-risk */
export default function ExecutionRiskBoard() {
  const { projection, loading, error } = useExecutionCommandCenter();

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4">
      <header className="flex items-center gap-2">
        <AlertTriangle className="h-6 w-6" aria-hidden />
        <h1 className="text-lg font-bold">Execution risk board</h1>
        <Link to="/admin/live-work-queues" className="ml-auto text-xs underline">
          Command center
        </Link>
      </header>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {loading && !projection ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
      {projection ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Ranked execution risk (deterministic)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            {projection.ordersAtRisk.map((r) => (
              <div key={r.entityKey} className="border-b border-border/50 pb-2">
                <p className="font-medium">
                  {r.level.toUpperCase()} · score {r.score}
                </p>
                <p>
                  {r.entityType} {r.entityId}
                </p>
                <p className="text-muted-foreground">{r.signals.join(" · ")}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
