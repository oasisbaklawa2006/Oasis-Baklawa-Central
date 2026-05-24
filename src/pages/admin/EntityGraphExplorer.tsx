import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Network, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { demoEntityGraphProjection } from "@/lib/entity-graph/entityProjection";
import { CANONICAL_ENTITY_RELATIONSHIPS } from "@/lib/entity-graph/entityRelationships";
import { ownershipForEntityType, formatOwnerRole } from "@/lib/entity-graph/entityOwnership";
import { emptySearchResult, searchOperationalIndex } from "@/lib/operational-search/searchProjection";
import type { OperationalSearchHit } from "@/lib/operational-search/searchEntityContracts";
import { projectOperationalTimeline } from "@/lib/operational-timeline/timelineEntityProjection";

export default function EntityGraphExplorer() {
  const graph = useMemo(() => demoEntityGraphProjection(), []);
  const [query, setQuery] = useState("");

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
    () => (query.trim() ? searchOperationalIndex(searchHits, { text: query, limit: 20 }) : emptySearchResult()),
    [query, searchHits],
  );

  const timeline = useMemo(
    () =>
      projectOperationalTimeline("operational", [
        {
          id: "tl-1",
          at: new Date().toISOString(),
          title: "Demo order linked to graph",
          visibilityClass: "operational",
          group: "order",
          entityRefs: graph.nodes[0]?.ref ? [graph.nodes[0].ref] : [],
        },
        {
          id: "tl-2",
          at: new Date().toISOString(),
          title: "Internal governance note",
          visibilityClass: "governance_internal",
          group: "governance",
        },
      ]),
    [graph.nodes],
  );

  const filteredNodes = useMemo(() => {
    if (!query.trim()) return graph.nodes;
    const ids = new Set(searchResult.hits.map((h) => h.entityId));
    return graph.nodes.filter((n) => ids.has(n.ref.id) || n.label.toLowerCase().includes(query.toLowerCase()));
  }, [graph.nodes, query, searchResult.hits]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 pb-24">
      <header className="flex flex-wrap items-center gap-2 border-b border-border pb-4">
        <Network className="h-7 w-7 text-primary" aria-hidden />
        <h1 className="text-xl font-bold tracking-tight">Entity graph explorer</h1>
        <Badge variant="outline" className="text-[10px] uppercase">
          Demo projection
        </Badge>
      </header>
      <p className="text-xs text-muted-foreground">
        Relationship explorer and unified search contracts. Demo graph uses explicit sample refs — not live database
        rows. No mutations.
      </p>

      <div className="relative max-w-md">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
        <Input
          className="pl-9"
          placeholder="Search SO, UUID, carton…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Operational search"
        />
      </div>

      {searchResult.hits.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Search hits</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-xs">
            {searchResult.hits.map((h) => (
              <p key={`${h.entityType}-${h.entityId}`}>
                {h.label} · <span className="font-mono text-muted-foreground">{h.entityType}</span>
              </p>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Entity nodes</CardTitle>
            <CardDescription className="text-xs">{filteredNodes.length} nodes · {graph.edges.length} edges</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {filteredNodes.map((node) => {
              const own = ownershipForEntityType(node.ref.type);
              return (
                <div key={node.ref.id} className="rounded-md border border-border/70 px-2 py-2 text-xs">
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="font-medium">{node.label}</span>
                    <Badge variant="outline" className="text-[9px]">
                      {node.ref.type}
                    </Badge>
                    <Badge variant="secondary" className="text-[9px]">
                      {node.priorityBand}
                    </Badge>
                  </div>
                  <p className="mt-1 font-mono text-[10px] text-muted-foreground">{node.ref.id}</p>
                  <p className="mt-1 text-muted-foreground">
                    Owner: {own ? formatOwnerRole(own.primaryOwner) : "—"} · {node.readiness.summary}
                  </p>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Canonical relationships</CardTitle>
          </CardHeader>
          <CardContent className="max-h-80 space-y-1 overflow-y-auto text-[11px] text-muted-foreground">
            {CANONICAL_ENTITY_RELATIONSHIPS.map((r) => (
              <p key={r.id}>
                <span className="font-mono text-foreground/80">{r.from}</span> →{" "}
                <span className="font-mono text-foreground/80">{r.to}</span> ({r.label})
              </p>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Operational timeline (projection)</CardTitle>
          <CardDescription className="text-xs">Governance-internal events hidden from customer_safe.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1 text-xs">
          {timeline.events.length === 0 ? (
            <p className="text-muted-foreground">No visible events for operational audience.</p>
          ) : (
            timeline.events.map((e) => (
              <p key={e.id}>
                {e.title} · <span className="text-muted-foreground">{e.group}</span>
              </p>
            ))
          )}
        </CardContent>
      </Card>

      <Link
        to="/admin/live-work-queues"
        className="inline-flex min-h-9 items-center rounded-md border border-border px-3 text-xs font-medium hover:bg-muted"
      >
        Live work queues
      </Link>
    </div>
  );
}
