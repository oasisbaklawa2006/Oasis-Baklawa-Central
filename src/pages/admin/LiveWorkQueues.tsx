import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ListOrdered, GitBranch, RefreshCw, Filter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { groupQueueItemsByOwner } from "@/lib/work-queues/queueGrouping";
import { interpretQueueReadiness } from "@/lib/work-queues/queueReadiness";
import { formatOwnerRole } from "@/lib/entity-graph/entityOwnership";
import { financeBlocksProductionProjection } from "@/lib/dependency-graph/dependencyProjection";
import { useOperationalLiveFeeds } from "@/hooks/useOperationalLiveFeeds";
import { OperationalReadOnlyBanner } from "@/components/admin/OperationalReadOnlyBanner";
import { QueueItemDetailDrawer } from "@/components/admin/QueueItemDetailDrawer";
import type { WorkQueueItem } from "@/lib/work-queues/queueTypes";
import { WORK_QUEUE_LABELS } from "@/lib/work-queues/queueTypes";

export default function LiveWorkQueues() {
  const { loading, error, feeds, refresh } = useOperationalLiveFeeds();
  const dependency = useMemo(() => financeBlocksProductionProjection(), []);

  const [queueFilter, setQueueFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [escalationFilter, setEscalationFilter] = useState<string>("all");
  const [customerRiskOnly, setCustomerRiskOnly] = useState(false);
  const [blockedOnly, setBlockedOnly] = useState(false);
  const [selectedItem, setSelectedItem] = useState<WorkQueueItem | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const snapshots = feeds?.snapshots ?? [];
  const allItems = useMemo(() => snapshots.flatMap((q) => q.items), [snapshots]);

  const filteredItems = useMemo(() => {
    return allItems.filter((item) => {
      if (queueFilter !== "all" && item.queueId !== queueFilter) return false;
      if (priorityFilter !== "all" && item.priority !== priorityFilter) return false;
      if (departmentFilter !== "all" && item.ownerRole !== departmentFilter) return false;
      if (escalationFilter !== "all" && item.escalationTier !== escalationFilter) return false;
      if (customerRiskOnly && !item.customerImpact) return false;
      if (blockedOnly && item.readiness.state !== "blocked") return false;
      return true;
    });
  }, [allItems, queueFilter, priorityFilter, departmentFilter, escalationFilter, customerRiskOnly, blockedOnly]);

  const openDetail = (item: WorkQueueItem) => {
    setSelectedItem(item);
    setDrawerOpen(true);
  };

  const feedForItem = selectedItem ? feeds?.byQueue[selectedItem.queueId] ?? null : null;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 pb-24">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <ListOrdered className="h-7 w-7 text-primary" aria-hidden />
          <h1 className="text-xl font-bold tracking-tight">Live work queues</h1>
          <Badge variant="outline" className="text-[10px] uppercase">
            Read-only feeds
          </Badge>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => refresh()} disabled={loading}>
          <RefreshCw className={`mr-1 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden />
          Refresh
        </Button>
      </header>

      <OperationalReadOnlyBanner warnings={feeds?.allWarnings} />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      <Card className="border-border/80">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Filter className="h-4 w-4" aria-hidden />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Select value={queueFilter} onValueChange={setQueueFilter}>
            <SelectTrigger className="h-8 w-[160px] text-xs">
              <SelectValue placeholder="Queue" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All queues</SelectItem>
              {Object.entries(WORK_QUEUE_LABELS).map(([id, label]) => (
                <SelectItem key={id} value={id}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="h-8 w-[120px] text-xs">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              {["all", "critical", "urgent", "elevated", "routine"].map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
            <SelectTrigger className="h-8 w-[160px] text-xs">
              <SelectValue placeholder="Department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All owners</SelectItem>
              {[...new Set(allItems.map((i) => i.ownerRole))].map((r) => (
                <SelectItem key={r} value={r}>
                  {formatOwnerRole(r)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={escalationFilter} onValueChange={setEscalationFilter}>
            <SelectTrigger className="h-8 w-[140px] text-xs">
              <SelectValue placeholder="Escalation" />
            </SelectTrigger>
            <SelectContent>
              {["all", "none", "team_lead", "department_head", "cmd"].map((e) => (
                <SelectItem key={e} value={e}>
                  {e}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant={customerRiskOnly ? "default" : "outline"}
            size="sm"
            className="h-8 text-xs"
            onClick={() => setCustomerRiskOnly((v) => !v)}
          >
            Customer risk
          </Button>
          <Button
            type="button"
            variant={blockedOnly ? "default" : "outline"}
            size="sm"
            className="h-8 text-xs"
            onClick={() => setBlockedOnly((v) => !v)}
          >
            Blocked only
          </Button>
        </CardContent>
      </Card>

      <Card className="border-amber-200/60 bg-amber-50/30 dark:bg-amber-950/20">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <GitBranch className="h-4 w-4" aria-hidden />
            Unified blocker lane
          </CardTitle>
          <CardDescription className="text-xs">{feeds?.cmdPressure.unifiedBlockerContext}</CardDescription>
        </CardHeader>
        <CardContent className="text-xs">
          <p>
            <span className="font-medium">Root:</span> {feeds?.cmdPressure.unifiedRootBlocker ?? dependency.resolution.rootBlocker?.label ?? "—"}
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {snapshots.map((q) => {
          const feed = feeds?.byQueue[q.queueId];
          const queueItems = filteredItems.filter((i) => i.queueId === q.queueId);
          return (
            <Card key={q.queueId} className="border-border/80">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-sm">{q.label}</CardTitle>
                  <Badge variant="secondary" className="shrink-0 font-mono text-[10px]">
                    {q.pressureCount === null ? "pending" : q.pressureCount}
                  </Badge>
                </div>
                <CardDescription className="text-[10px]">
                  {feed?.source ?? "—"} · {feed?.freshness ?? "—"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-[11px]">
                {feed?.warnings?.[0] ? <p className="text-amber-800 dark:text-amber-200">{feed.warnings[0]}</p> : null}
                {loading ? (
                  <p className="text-muted-foreground">Loading…</p>
                ) : queueItems.length === 0 ? (
                  <p className="text-muted-foreground">No items match filters.</p>
                ) : (
                  queueItems.slice(0, 8).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="w-full rounded-md border border-border/70 bg-muted/20 px-2 py-1.5 text-left transition hover:bg-muted/40"
                      onClick={() => openDetail(item)}
                    >
                      <p className="font-medium">{item.title}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        <Badge variant="outline" className="text-[9px]">
                          {item.priority}
                        </Badge>
                        <Badge variant="outline" className="text-[9px]">
                          {interpretQueueReadiness(item.readiness)}
                        </Badge>
                        <Badge variant="outline" className="text-[9px]">
                          {formatOwnerRole(item.ownerRole)}
                        </Badge>
                      </div>
                    </button>
                  ))
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <QueueItemDetailDrawer item={selectedItem} feed={feedForItem} open={drawerOpen} onOpenChange={setDrawerOpen} />

      <Link
        to="/admin/entity-graph-explorer"
        className="inline-flex min-h-9 items-center rounded-md border border-border px-3 text-xs font-medium hover:bg-muted"
      >
        Entity graph explorer
      </Link>
    </div>
  );
}
