import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BellRing, ExternalLink } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  buildNotificationProjectionCatalog,
  filterNotificationProjectionsBySeverity,
  filterNotificationProjectionsBySource,
} from "@/lib/notifications/notificationProjection";
import { notificationTopicSeverity } from "@/lib/notifications/notificationSeverity";
import type { NotificationSourceFilter } from "@/lib/notifications/notificationTypes";
import type { OperationalEventSeverity } from "@/lib/operational-events/types";
import { OperationalTimeline } from "@/components/admin/OperationalTimeline";
import { buildNotificationOperationalFeed } from "@/lib/operational-events/notificationFeed";
import { dedupeOperationalEventsById } from "@/lib/operational-events/normalize";

const SOURCE_OPTIONS: { value: NotificationSourceFilter; label: string }[] = [
  { value: "all", label: "All sources" },
  { value: "finance", label: "Finance" },
  { value: "dispatch", label: "Dispatch" },
  { value: "communication", label: "Communication" },
  { value: "retail", label: "Retail" },
  { value: "inventory", label: "Inventory" },
  { value: "labels", label: "Labels" },
  { value: "support", label: "Support" },
  { value: "approvals", label: "Approvals" },
  { value: "production", label: "Production" },
];

const SEVERITY_OPTIONS: { value: OperationalEventSeverity | "all"; label: string }[] = [
  { value: "all", label: "All severities" },
  { value: "info", label: "Info" },
  { value: "warning", label: "Warning" },
  { value: "urgent", label: "Urgent" },
  { value: "critical", label: "Critical" },
];

/**
 * Visibility-only notification center — no send engine, no outbox, no persistence.
 */
export default function NotificationCenter() {
  const [source, setSource] = useState<NotificationSourceFilter>("all");
  const [severity, setSeverity] = useState<OperationalEventSeverity | "all">("all");

  const catalog = useMemo(() => buildNotificationProjectionCatalog({}), []);

  const filteredCards = useMemo(() => {
    const bySrc = filterNotificationProjectionsBySource(catalog, source);
    return filterNotificationProjectionsBySeverity(bySrc, severity);
  }, [catalog, source, severity]);

  const timelineEvents = useMemo(
    () => dedupeOperationalEventsById(buildNotificationOperationalFeed({ includeVisibilityExplainer: true })),
    [],
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 pb-24">
      <header className="space-y-2 border-b border-border pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <BellRing className="h-6 w-6 text-primary" aria-hidden />
          <h1 className="text-xl font-bold tracking-tight">Notification Center</h1>
          <Badge variant="outline" className="text-[10px] uppercase">
            Visibility only
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Notifications shown here are operational projections only. No SMS, WhatsApp, or email is sent from this screen.
          There is no outbox, scheduling engine, or delivery retries.
        </p>
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-950 dark:text-amber-50">
          <strong className="font-semibold">Send engine off.</strong> Status for every row is either visibility-only or pending backend — use existing manual channels until a reviewed notification service exists.
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="notif-source">Source filter</Label>
          <Select value={source} onValueChange={(v) => setSource(v as NotificationSourceFilter)}>
            <SelectTrigger id="notif-source">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SOURCE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="notif-severity">Severity filter</Label>
          <Select value={severity} onValueChange={(v) => setSeverity(v as OperationalEventSeverity | "all")}>
            <SelectTrigger id="notif-severity">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SEVERITY_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <section className="space-y-3" aria-label="Notification projection cards">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Projection cards</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {filteredCards.map((row) => {
            const sev = notificationTopicSeverity(row.topic);
            const tone =
              sev === "critical"
                ? "border-destructive/50 bg-destructive/10"
                : sev === "urgent"
                  ? "border-orange-500/40 bg-orange-500/10"
                  : sev === "warning"
                    ? "border-amber-500/40 bg-amber-500/10"
                    : "border-border bg-card";
            return (
              <Card key={row.id} className={`shadow-none ring-1 ring-border/40 ${tone}`}>
                <CardHeader className="space-y-1 pb-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="text-sm font-semibold leading-snug">{row.title}</CardTitle>
                    <Badge variant="secondary" className="text-[9px] uppercase">
                      {row.source}
                    </Badge>
                    <Badge variant="outline" className="text-[9px] uppercase">
                      {sev}
                    </Badge>
                  </div>
                  <CardDescription className="text-[11px] leading-snug">{row.summary}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-[11px] text-muted-foreground">
                  <p>
                    <span className="font-medium text-foreground">Backend:</span> {row.backendStatus.replace(/_/g, " ")}
                  </p>
                  {row.signalHint ? (
                    <p className="rounded border border-border/60 bg-muted/30 p-2 text-foreground/90">{row.signalHint}</p>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="space-y-2" aria-label="Notification projection timeline">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Operational timeline (projections)</h2>
        <p className="text-[11px] text-muted-foreground">occurredAt is empty for snapshot rows — no fabricated delivery timestamps.</p>
        <OperationalTimeline events={timelineEvents} defaultFilter="all" showFilters={false} ariaLabel="Notification projection timeline" />
      </section>

      <p className="text-center text-[11px] text-muted-foreground">
        For live orders use{" "}
        <Link to="/admin/cmd-war-room" className="font-medium text-primary underline-offset-2 hover:underline">
          CMD War Room
        </Link>
        .{" "}
        <Link to="/admin/notifications" className="inline-flex items-center gap-1 font-medium text-primary underline-offset-2 hover:underline">
          Legacy notifications <ExternalLink className="h-3 w-3" aria-hidden />
        </Link>
      </p>
    </div>
  );
}
