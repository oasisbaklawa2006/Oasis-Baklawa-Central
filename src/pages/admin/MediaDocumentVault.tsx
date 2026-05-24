import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FolderOpen } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { buildMediaVaultProjectionCatalog, groupMediaVaultItems } from "@/lib/media-vault/mediaVaultProjection";
import type { MediaVaultGroup } from "@/lib/media-vault/mediaVaultTypes";
import { OperationalTimeline } from "@/components/admin/OperationalTimeline";
import { buildMediaOperationalFeed } from "@/lib/operational-events/mediaFeed";
import { dedupeOperationalEventsById } from "@/lib/operational-events/normalize";

const GROUP_LABEL: Record<MediaVaultGroup, string> = {
  financial: "Financial documents",
  dispatch: "Dispatch & packing",
  labels: "Labels",
  communication: "Communication",
  customer: "Customer references",
  support: "Support",
};

const GROUP_ORDER: MediaVaultGroup[] = ["financial", "dispatch", "labels", "communication", "customer", "support"];

/**
 * Metadata-only media / document vault — no uploads, no storage, no public sharing.
 */
export default function MediaDocumentVault() {
  const [groupFilter, setGroupFilter] = useState<MediaVaultGroup | "all">("all");

  const catalog = useMemo(() => buildMediaVaultProjectionCatalog(), []);
  const grouped = useMemo(() => groupMediaVaultItems(catalog), [catalog]);

  const visibleGroups = useMemo(() => {
    if (groupFilter === "all") return GROUP_ORDER;
    return [groupFilter];
  }, [groupFilter]);

  const timelineEvents = useMemo(
    () => dedupeOperationalEventsById(buildMediaOperationalFeed({ includeMetadataExplainer: true })),
    [],
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 pb-24">
      <header className="space-y-2 border-b border-border pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <FolderOpen className="h-6 w-6 text-primary" aria-hidden />
          <h1 className="text-xl font-bold tracking-tight">Media / document vault</h1>
          <Badge variant="outline" className="text-[10px] uppercase">
            Metadata only
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Preview-only visibility layer for future invoice, receipt, packing, dispatch, label, and support artifacts. No file upload, no binary duplication, and no signed public URLs are created here.
        </p>
        <div className="rounded-md border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-[11px] text-sky-950 dark:text-sky-50">
          <strong className="font-semibold">Upload backend pending.</strong> Rows below are shell metadata until a storage integration and RLS review ship in a separate change.
        </div>
      </header>

      <div className="max-w-md space-y-2">
        <Label htmlFor="vault-group">Group filter</Label>
        <Select value={groupFilter} onValueChange={(v) => setGroupFilter(v as MediaVaultGroup | "all")}>
          <SelectTrigger id="vault-group">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All groups</SelectItem>
            {GROUP_ORDER.map((g) => (
              <SelectItem key={g} value={g}>
                {GROUP_LABEL[g]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <section className="space-y-6" aria-label="Document groups">
        {visibleGroups.map((g) => (
          <div key={g} className="space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">{GROUP_LABEL[g]}</h2>
            <div className="grid gap-3 md:grid-cols-2">
              {grouped[g].map((row) => (
                <Card key={row.id} className="shadow-none ring-1 ring-border/40">
                  <CardHeader className="space-y-1 pb-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="text-sm font-semibold leading-snug">{row.title}</CardTitle>
                      <Badge variant="secondary" className="text-[9px] uppercase">
                        {row.sourceChip}
                      </Badge>
                      <Badge variant="outline" className="text-[9px] uppercase">
                        {row.entityTypeLabel}
                      </Badge>
                      {row.isShellSample ? (
                        <Badge variant="destructive" className="text-[9px] uppercase">
                          Shell sample
                        </Badge>
                      ) : null}
                    </div>
                    <CardDescription className="text-[11px] leading-snug">{row.summary}</CardDescription>
                  </CardHeader>
                  <CardContent className="text-[11px] text-muted-foreground">
                    <p>
                      <span className="font-medium text-foreground">Backend:</span> {row.backendStatus.replace(/_/g, " ")}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="space-y-2" aria-label="Media projection timeline">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Operational timeline (metadata)</h2>
        <p className="text-[11px] text-muted-foreground">occurredAt is empty for snapshot rows.</p>
        <OperationalTimeline events={timelineEvents} defaultFilter="all" showFilters={false} ariaLabel="Media vault projection timeline" />
      </section>

      <p className="text-center text-[11px] text-muted-foreground">
        Label JSON payloads live in{" "}
        <Link to="/admin/label-command-center" className="font-medium text-primary underline-offset-2 hover:underline">
          Label command center
        </Link>
        .
      </p>
    </div>
  );
}
