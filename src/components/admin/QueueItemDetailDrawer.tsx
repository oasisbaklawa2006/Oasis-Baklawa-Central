import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import type { WorkQueueItem } from "@/lib/work-queues/queueTypes";
import { formatOwnerRole } from "@/lib/entity-graph/entityOwnership";
import type { LiveFeedResult } from "@/lib/live-feeds/feedTypes";

interface QueueItemDetailDrawerProps {
  item: WorkQueueItem | null;
  feed: LiveFeedResult | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QueueItemDetailDrawer({ item, feed, open, onOpenChange }: QueueItemDetailDrawerProps) {
  if (!item) return null;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="text-base">{item.title}</SheetTitle>
          <SheetDescription>Read-only queue item detail — no actions available.</SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-3 text-xs">
          <div className="flex flex-wrap gap-1">
            <Badge variant="outline">{item.priority}</Badge>
            <Badge variant="outline">{item.readiness.state}</Badge>
            <Badge variant="secondary">{formatOwnerRole(item.ownerRole)}</Badge>
            <Badge variant="outline">{item.escalationTier}</Badge>
            {item.customerImpact ? <Badge className="bg-rose-100 text-rose-900">customer impact</Badge> : null}
          </div>
          {item.summary ? <p className="text-muted-foreground">{item.summary}</p> : null}
          {item.blockers.length > 0 ? (
            <div>
              <p className="font-medium">Blockers</p>
              <ul className="list-inside list-disc text-muted-foreground">
                {item.blockers.map((b) => (
                  <li key={b.code}>{b.label}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {item.dependency.downstreamImpact ? (
            <p className="text-amber-800 dark:text-amber-200">{item.dependency.downstreamImpact}</p>
          ) : null}
          <div>
            <p className="font-medium">Entities</p>
            {item.entityRefs.map((r) => (
              <p key={r.id} className="font-mono text-[10px] text-muted-foreground">
                {r.type} · {r.displayKey ?? r.id}
              </p>
            ))}
          </div>
          {feed ? (
            <div className="rounded-md border border-border/70 bg-muted/20 p-2">
              <p className="font-medium">Feed</p>
              <p className="text-muted-foreground">{feed.source}</p>
              <p className="text-muted-foreground">Freshness: {feed.freshness}</p>
              {feed.warnings.map((w) => (
                <p key={w} className="text-amber-800 dark:text-amber-200">
                  {w}
                </p>
              ))}
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
