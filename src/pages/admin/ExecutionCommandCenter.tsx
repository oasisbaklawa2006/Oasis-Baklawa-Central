import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Gauge,
  GitBranch,
  ListOrdered,
  RefreshCw,
  ScanLine,
  Shield,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { OperationalReadOnlyBanner } from "@/components/admin/OperationalReadOnlyBanner";
import { ExecutionInternalOnlyBanner } from "@/components/execution/ExecutionInternalOnlyBanner";
import { useExecutionCommandCenter } from "@/hooks/useExecutionCommandCenter";

function SeverityBadge({ value }: { value: string }) {
  const variant =
    value === "critical" ? "destructive" : value === "high" || value === "breached" ? "default" : "secondary";
  return (
    <Badge variant={variant} className="text-[10px] uppercase">
      {value}
    </Badge>
  );
}

/**
 * Execution OS Command Center — read-only operational intelligence.
 * Route: /admin/execution-command-center
 */
export default function ExecutionCommandCenter() {
  const { loading, error, projection, refresh, feeds } = useExecutionCommandCenter();
  const [eventSeverity, setEventSeverity] = useState<string>("all");

  useEffect(() => {
    document.title = "Execution Command Center";
  }, []);

  const filteredEvents = useMemo(() => {
    if (!projection) return [];
    if (eventSeverity === "all") return projection.eventStream;
    return projection.eventStream.filter((e) => e.severity === eventSeverity);
  }, [projection, eventSeverity]);

  if (!projection && loading) {
    return <p className="p-6 text-sm text-muted-foreground">Loading execution intelligence…</p>;
  }

  const p = projection;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 pb-24">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <Gauge className="h-7 w-7 text-primary" aria-hidden />
          <h1 className="text-xl font-bold tracking-tight">Execution Command Center</h1>
          <Badge variant="outline" className="text-[10px] uppercase">
            Read-only intelligence
          </Badge>
          {p ? (
            <Badge variant="secondary" className="text-[10px]">
              Confidence {p.executionConfidence}%
            </Badge>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" asChild>
            <Link to="/admin/cmd-war-room">Legacy War Room</Link>
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => refresh()} disabled={loading}>
            <RefreshCw className={`mr-1 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden />
            Refresh
          </Button>
        </div>
      </header>

      <OperationalReadOnlyBanner warnings={feeds?.allWarnings} />
      <ExecutionInternalOnlyBanner />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      {p ? (
        <>
          {/* Global Queue Pressure Strip */}
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Open queues", value: p.globalQueuePressure.open, icon: ListOrdered },
              { label: "SLA breached", value: p.globalQueuePressure.breached, icon: AlertTriangle },
              { label: "Blocked", value: p.globalQueuePressure.blocked, icon: Shield },
              { label: "Escalated", value: p.globalQueuePressure.escalated, icon: Activity },
            ].map(({ label, value, icon: Icon }) => (
              <Card key={label}>
                <CardHeader className="pb-1">
                  <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <Icon className="h-3.5 w-3.5" aria-hidden />
                    {label}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold tabular-nums">{value}</p>
                </CardContent>
              </Card>
            ))}
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* SLA Breach Board */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">SLA breach board</CardTitle>
                <CardDescription className="text-xs">Aging, breached, and critical — no auto-actions</CardDescription>
              </CardHeader>
              <CardContent className="max-h-64 space-y-2 overflow-y-auto text-xs">
                {p.slaBreaches.slice(0, 12).map((s) => (
                  <div key={s.queueItemId} className="flex justify-between gap-2 border-b border-border/60 pb-1">
                    <span className="truncate">{s.queueItemId.slice(0, 8)}… · {s.ageHours.toFixed(0)}h</span>
                    <SeverityBadge value={s.severity} />
                  </div>
                ))}
                {p.slaBreaches.length === 0 ? <p className="text-muted-foreground">No open SLA pressure</p> : null}
              </CardContent>
            </Card>

            {/* Escalation Hotspots */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Escalation hotspots</CardTitle>
              </CardHeader>
              <CardContent className="max-h-64 space-y-2 overflow-y-auto text-xs">
                {p.escalationHotspots.map((h) => (
                  <div key={h.department} className="flex justify-between">
                    <span>{h.department}</span>
                    <span className="text-muted-foreground">
                      esc {h.escalationCount} · blk {h.blockedCount}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Congestion Heatmap */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Department congestion heatmap</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {p.congestionHeatmap.map((c) => (
                <div
                  key={c.department}
                  className="rounded-md border border-border px-3 py-2 text-xs"
                  style={{ opacity: Math.min(1, 0.4 + c.heat / 20) }}
                >
                  <span className="font-medium">{c.department}</span>
                  <span className="ml-2 text-muted-foreground">
                    open {c.openCount} · heat {c.heat}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Orders At Risk */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Orders at risk today</CardTitle>
                <CardDescription className="text-xs">
                  <Link to="/admin/execution-risk" className="underline">
                    Full risk board
                  </Link>
                </CardDescription>
              </CardHeader>
              <CardContent className="max-h-56 space-y-2 overflow-y-auto text-xs">
                {p.ordersAtRisk.map((r) => (
                  <div key={r.entityKey} className="border-b border-border/50 pb-1">
                    <div className="flex justify-between">
                      <span>{r.entityType}/{r.entityId.slice(0, 8)}…</span>
                      <SeverityBadge value={r.level} />
                    </div>
                    <p className="text-[10px] text-muted-foreground">{r.signals.join(", ")}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Customer-Risk Lane (internal) */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Customer-risk lane (staff only)</CardTitle>
                <CardDescription className="text-xs">Internal weighting — not customer-published</CardDescription>
              </CardHeader>
              <CardContent className="max-h-56 space-y-2 overflow-y-auto text-xs">
                {p.customerRiskLane.map((r) => (
                  <div key={r.entityKey} className="flex justify-between">
                    <span>Order-linked · score {r.score}</span>
                    <SeverityBadge value={r.level} />
                  </div>
                ))}
                {p.customerRiskLane.length === 0 ? (
                  <p className="text-muted-foreground">No elevated customer-risk signals</p>
                ) : null}
              </CardContent>
            </Card>
          </div>

          {/* Bottleneck Graph */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <GitBranch className="h-4 w-4" aria-hidden />
                Execution bottleneck graph
              </CardTitle>
              <CardDescription className="text-xs">
                <Link to="/admin/execution-bottlenecks" className="underline">
                  Bottleneck detail
                </Link>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-1 text-xs">
              {p.bottlenecks.slice(0, 15).map((n) => (
                <div key={n.id} className={n.blocked ? "text-destructive" : ""} style={{ paddingLeft: n.depth * 12 }}>
                  {n.label}
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Scan failures */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <ScanLine className="h-4 w-4" aria-hidden />
                  Scan verification failures
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs">
                {p.scanHotspots
                  .filter((h) => h.status === "mismatch" || h.status === "rejected")
                  .map((h) => (
                    <p key={`${h.scanType}-${h.status}`}>
                      {h.scanType} / {h.status}: {h.count}
                    </p>
                  ))}
                {p.scanHotspots.length === 0 ? <p className="text-muted-foreground">No scan hotspots</p> : null}
              </CardContent>
            </Card>

            {/* Pending gate */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Pending gate verification</CardTitle>
              </CardHeader>
              <CardContent className="max-h-40 space-y-1 overflow-y-auto text-xs">
                {p.pendingGateVerifications.map((s) => (
                  <p key={s.id}>
                    {s.barcodeValue} · {s.verificationStatus}
                  </p>
                ))}
                {p.pendingGateVerifications.length === 0 ? (
                  <p className="text-muted-foreground">No pending gate scans</p>
                ) : null}
              </CardContent>
            </Card>
          </div>

          {/* Ownership Matrix */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4" aria-hidden />
                Queue ownership matrix
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 text-xs">
              {p.ownershipMatrix.slice(0, 12).map((o) => (
                <div key={o.actorKey} className="rounded border border-border/80 p-2">
                  <p className="font-medium">{o.actorKey === "__unowned__" ? "Unowned" : o.actorKey.slice(0, 12)}</p>
                  <p className="text-muted-foreground">
                    {o.department} · {o.assignedCount} items
                    {o.overloaded ? " · overloaded" : ""}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Throughput */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <BarChart3 className="h-4 w-4" aria-hidden />
                Department throughput snapshot
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3 text-xs">
              {p.departmentThroughput.map((d) => (
                <span key={d.department} className="rounded bg-muted px-2 py-1">
                  {d.department}: open {d.openQueues} · done24h {d.completedEvents24h}
                </span>
              ))}
            </CardContent>
          </Card>

          {/* Event stream */}
          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-sm">Live operational event stream</CardTitle>
              <select
                className="rounded border border-input bg-background px-2 py-1 text-xs"
                value={eventSeverity}
                onChange={(e) => setEventSeverity(e.target.value)}
                aria-label="Filter by severity"
              >
                <option value="all">All severities</option>
                <option value="critical">Critical</option>
                <option value="urgent">Urgent</option>
                <option value="warning">Warning</option>
                <option value="info">Info</option>
              </select>
            </CardHeader>
            <CardContent className="max-h-72 space-y-1 overflow-y-auto text-xs">
              {filteredEvents.map((ev) => (
                <div key={ev.id} className="flex gap-2 border-b border-border/40 py-1">
                  <SeverityBadge value={ev.severity} />
                  <span className="min-w-0 flex-1 truncate">
                    {ev.title} · {ev.eventType}
                  </span>
                  <span className="shrink-0 text-muted-foreground">
                    {new Date(ev.createdAt).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
