import { Link } from "react-router-dom";
import { GitBranch } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useExecutionCommandCenter } from "@/hooks/useExecutionCommandCenter";

/** Bottleneck topology — /admin/execution-bottlenecks */
export default function ExecutionBottlenecks() {
  const { projection, loading, error } = useExecutionCommandCenter();

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4">
      <header className="flex items-center gap-2">
        <GitBranch className="h-6 w-6" aria-hidden />
        <h1 className="text-lg font-bold">Execution bottlenecks</h1>
        <Link to="/admin/execution-command-center" className="ml-auto text-xs underline">
          Command center
        </Link>
      </header>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {loading && !projection ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
      {projection ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Blocker propagation (read-only)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 font-mono text-xs">
            {projection.bottlenecks.map((n) => (
              <div key={n.id} className={n.blocked ? "text-destructive" : ""} style={{ paddingLeft: n.depth * 16 }}>
                {n.label}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
