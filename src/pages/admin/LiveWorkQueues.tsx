import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ListOrdered, AlertTriangle, User, GitBranch, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { emptyWorkQueueProjection } from "@/lib/work-queues/queueProjection";
import { groupQueueItemsByOwner, groupQueueItemsByPriority } from "@/lib/work-queues/queueGrouping";
import { interpretQueueReadiness } from "@/lib/work-queues/queueReadiness";
import { formatOwnerRole } from "@/lib/entity-graph/entityOwnership";
import { financeBlocksProductionProjection } from "@/lib/dependency-graph/dependencyProjection";

export default function LiveWorkQueues() {
  const queues = useMemo(() => emptyWorkQueueProjection(), []);
  const dependency = useMemo(() => financeBlocksProductionProjection(), []);
  const allItems = useMemo(() => queues.flatMap((q) => q.items), [queues]);
  const byOwner = useMemo(() => groupQueueItemsByOwner(allItems), [allItems]);
  const byPriority = useMemo(() => groupQueueItemsByPriority(allItems), [allItems]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 pb-24">
      <header className="flex flex-wrap items-center gap-2 border-b border-border pb-4">
        <ListOrdered className="h-7 w-7 text-primary" aria-hidden />
        <h1 className="text-xl font-bold tracking-tight">Live work queues</h1>
        <Badge variant="outline" className="text-[10px] uppercase">
          Projection only
        </Badge>
      </header>
      <p className="text-xs text-muted-foreground">
        Queue cards, dependency ribbons, and owner lanes are read-only. No claim, reassignment, or auto-escalation. Counts
        show <span className="font-medium">pending</span> until operational feeds supply items.
      </p>

      <Card className="border-amber-200/60 bg-amber-50/30 dark:bg-amber-950/20">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <GitBranch className="h-4 w-4" aria-hidden />
            Unified blocker lane
          </CardTitle>
          <CardDescription className="text-xs">
            Dependency graph evaluation — finance→production→assembly→dispatch chain.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-xs">
          <p>
            <span className="font-medium">Root blocker:</span>{" "}
            {dependency.resolution.rootBlocker?.label ?? "—"}
          </p>
          <p className="text-muted-foreground">{dependency.resolution.escalationRecommendation}</p>
          {dependency.resolution.downstreamImpact.length > 0 ? (
            <ul className="list-inside list-disc text-muted-foreground">
              {dependency.resolution.downstreamImpact.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {queues.map((q) => (
          <Card key={q.queueId} className="border-border/80">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-sm">{q.label}</CardTitle>
                <Badge variant="secondary" className="shrink-0 font-mono text-[10px]">
                  {q.pressureCount === null ? "pending" : q.pressureCount}
                </Badge>
              </div>
              <CardDescription className="text-[10px]">{q.queueId}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-[11px]">
              {q.items.length === 0 ? (
                <p className="text-muted-foreground">No projected items — feed not connected.</p>
              ) : (
                q.items.map((item) => {
                  const readiness = interpretQueueReadiness(item.readiness);
                  return (
                    <div key={item.id} className="rounded-md border border-border/70 bg-muted/20 px-2 py-1.5">
                      <p className="font-medium">{item.title}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        <Badge variant="outline" className="text-[9px]">
                          {item.priority}
                        </Badge>
                        <Badge variant="outline" className="text-[9px]">
                          {readiness}
                        </Badge>
                        {item.customerImpact ? (
                          <Badge className="bg-rose-100 text-[9px] text-rose-900 dark:bg-rose-950 dark:text-rose-100">
                            customer impact
                          </Badge>
                        ) : null}
                        {item.escalationTier !== "none" ? (
                          <Badge variant="destructive" className="text-[9px]">
                            {item.escalationTier}
                          </Badge>
                        ) : null}
                      </div>
                      {item.blockers.length > 0 ? (
                        <p className="mt-1 text-muted-foreground">Blockers: {item.blockers.map((b) => b.label).join("; ")}</p>
                      ) : null}
                      {item.dependency.state !== "satisfied" ? (
                        <p className="mt-1 text-amber-800 dark:text-amber-200">{item.dependency.downstreamImpact}</p>
                      ) : null}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {byOwner.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4" aria-hidden />
              Owner lanes
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2 text-xs">
            {byOwner.map((g) => (
              <Badge key={g.ownerRole} variant="outline">
                {formatOwnerRole(g.ownerRole)} · {g.items.length}
              </Badge>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {byPriority.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <AlertTriangle className="h-4 w-4" aria-hidden />
              Priority bands
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2 text-xs">
            {byPriority.map((g) => (
              <Badge key={g.priority} variant="secondary">
                {g.priority} · {g.items.length}
              </Badge>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Link
          to="/admin/entity-graph-explorer"
          className="inline-flex min-h-9 items-center rounded-md border border-border px-3 text-xs font-medium hover:bg-muted"
        >
          Entity graph explorer
        </Link>
        <Link
          to="/admin/cmd-war-room"
          className="inline-flex min-h-9 items-center rounded-md border border-primary/40 bg-primary/5 px-3 text-xs font-medium text-primary"
        >
          CMD War Room
        </Link>
      </div>
      <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
        <Clock className="h-3 w-3" aria-hidden />
        Generated {queues[0]?.generatedAt ?? "—"} · read-only shell
      </p>
    </div>
  );
}
