import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Network, Search, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { projectEntityGraph } from "@/lib/entity-graph/entityProjection";
import { CANONICAL_ENTITY_RELATIONSHIPS } from "@/lib/entity-graph/entityRelationships";
import { ownershipForEntityType, formatOwnerRole } from "@/lib/entity-graph/entityOwnership";
import { searchOperationalIndex, emptySearchResult } from "@/lib/operational-search/searchProjection";
import type { OperationalSearchHit } from "@/lib/operational-search/searchEntityContracts";
import { useOperationalLiveFeeds } from "@/hooks/useOperationalLiveFeeds";
import { buildEntityGraphFeed } from "@/lib/live-feeds/entityGraphFeed";
import { OperationalReadOnlyBanner } from "@/components/admin/OperationalReadOnlyBanner";
import { EntityDetailDrawer } from "@/components/admin/EntityDetailDrawer";
import type { ProjectedEntityNode } from "@/lib/entity-graph/entityProjection";
import { financeBlocksProductionProjection } from "@/lib/dependency-graph/dependencyProjection";

export default function EntityGraphExplorer() {
  const { loading, error, feeds, feedContext, refresh } = useOperationalLiveFeeds();
  const [query, setQuery] = useState("");
  const [selectedNode, setSelectedNode] = useState<ProjectedEntityNode | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const graphFeed = useMemo(() => {
    if (!feedContext) return null;
    return buildEntityGraphFeed(feedContext);
  }, [feedContext]);

  const graph = useMemo(() => {
    if (!graphFeed) return projectEntityGraph([]);
    return projectEntityGraph(graphFeed.nodes);
  }, [graphFeed]);

  const searchHits: OperationalSearchHit[] = useMemo(
    () =>
      graph.nodes.map((n) => ({
        kind: "uuid" as const,
        query: n.ref.displayKey ?? n.ref.id,
        entityType: n.ref.type,
        entityId: n.ref.id,
        label: n.label,
        group: n.ref.type,
      })),
    [graph.nodes],
  );

  const searchResult = useMemo(
    () => (query.trim() ? searchOperationalIndex(searchHits, { text: query, limit: 30 }) : emptySearchResult()),
    [query, searchHits],
  );

  const filteredNodes = useMemo(() => {
    if (!query.trim()) return graph.nodes;
    const ids = new Set(searchResult.hits.map((h) => h.entityId));
    return graph.nodes.filter((n) => ids.has(n.ref.id) || n.label.toLowerCase().includes(query.toLowerCase()));
  }, [graph.nodes, query, searchResult.hits]);

  const dependency = useMemo(() => financeBlocksProductionProjection(), []);

  const warnings = [...(graphFeed?.warnings ?? []), ...(feeds?.allWarnings ?? [])];

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 pb-24">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <Network className="h-7 w-7 text-primary" aria-hidden />
          <h1 className="text-xl font-bold tracking-tight">Entity graph explorer</h1>
          <Badge variant="outline" className="text-[10px] uppercase">
            Live read-only
          </Badge>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => refresh()} disabled={loading}>
          <RefreshCw className={`mr-1 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden />
          Refresh
        </Button>
      </header>

      <OperationalReadOnlyBanner warnings={warnings} />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      <div className="relative max-w-md">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
        <Input
          className="pl-9"
          placeholder="Search SO, customer, entity id…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Operational search"
        />
      </div>

      <p className="text-xs text-muted-foreground">
        Orders in window: {feedContext?.orders.length ?? 0} · Complaint placeholders:{" "}
        {graphFeed?.complaintPlaceholderCount ?? 0} · Edges: {graph.edges.length}
      </p>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Entity nodes</CardTitle>
            <CardDescription className="text-xs">{filteredNodes.length} shown</CardDescription>
          </CardHeader>
          <CardContent className="max-h-[28rem] space-y-2 overflow-y-auto">
            {loading ? (
              <p className="text-muted-foreground">Loading…</p>
            ) : filteredNodes.length === 0 ? (
              <p className="text-muted-foreground">No entities to display.</p>
            ) : (
              filteredNodes.map((node) => {
                const own = ownershipForEntityType(node.ref.type);
                return (
                  <button
                    key={`${node.ref.type}-${node.ref.id}`}
                    type="button"
                    className="w-full rounded-md border border-border/70 px-2 py-2 text-left text-xs hover:bg-muted/30"
                    onClick={() => {
                      setSelectedNode(node);
                      setDrawerOpen(true);
                    }}
                  >
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="font-medium">{node.label}</span>
                      <Badge variant="outline" className="text-[9px]">
                        {node.ref.type}
                      </Badge>
                    </div>
                    <p className="mt-1 text-muted-foreground">
                      {own ? formatOwnerRole(own.primaryOwner) : "—"} · {node.readiness.summary}
                    </p>
                  </button>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Canonical relationships</CardTitle>
          </CardHeader>
          <CardContent className="max-h-[28rem] overflow-y-auto text-[11px] text-muted-foreground">
            {CANONICAL_ENTITY_RELATIONSHIPS.map((r) => (
              <p key={r.id}>
                {r.from} → {r.to} ({r.label})
              </p>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Dependency downstream impact</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          {dependency.resolution.downstreamImpact.join(" · ") || "—"}
        </CardContent>
      </Card>

      <EntityDetailDrawer
        node={selectedNode}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        downstreamImpact={dependency.resolution.downstreamImpact}
      />

      <Link to="/admin/live-work-queues" className="inline-flex min-h-9 items-center rounded-md border px-3 text-xs font-medium hover:bg-muted">
        Live work queues
      </Link>
    </div>
  );
}
