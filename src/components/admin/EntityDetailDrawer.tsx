import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import type { ProjectedEntityNode } from "@/lib/entity-graph/entityProjection";
import { formatOwnerRole, ownershipForEntityType } from "@/lib/entity-graph/entityOwnership";
import { incomingRelationships, outgoingRelationships } from "@/lib/entity-graph/entityRelationships";
import { projectCustomerSafeOrder } from "@/lib/customer-safe/customerProjection";

interface EntityDetailDrawerProps {
  node: ProjectedEntityNode | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  downstreamImpact?: string[];
}

export function EntityDetailDrawer({ node, open, onOpenChange, downstreamImpact = [] }: EntityDetailDrawerProps) {
  if (!node) return null;
  const own = ownershipForEntityType(node.ref.type);
  const safePreview =
    node.ref.type === "order"
      ? projectCustomerSafeOrder({
          orderId: node.ref.id,
          displayLabel: node.ref.displayKey ?? node.ref.id,
          activeStatus: "in_preparation",
          timelineEvents: [],
        })
      : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="text-base">{node.label}</SheetTitle>
          <SheetDescription>
            Internal operational view. Customer-safe slice shown below when applicable.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-3 text-xs">
          <div className="flex flex-wrap gap-1">
            <Badge variant="outline">{node.ref.type}</Badge>
            <Badge variant="secondary">{node.priorityBand}</Badge>
            <Badge variant="outline">{node.readiness.state}</Badge>
          </div>
          <p className="font-mono text-[10px] text-muted-foreground">{node.ref.id}</p>
          <p>
            <span className="font-medium">Owner (internal):</span> {own ? formatOwnerRole(own.primaryOwner) : "—"}
          </p>
          <p className="text-muted-foreground">{node.readiness.summary}</p>
          {downstreamImpact.length > 0 ? (
            <div>
              <p className="font-medium">Downstream impact</p>
              <ul className="list-inside list-disc text-muted-foreground">
                {downstreamImpact.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <div>
            <p className="font-medium">Relationships</p>
            <p className="text-muted-foreground">Outgoing: {outgoingRelationships(node.ref.type).map((r) => r.to).join(", ") || "—"}</p>
            <p className="text-muted-foreground">Incoming: {incomingRelationships(node.ref.type).map((r) => r.from).join(", ") || "—"}</p>
          </div>
          {safePreview ? (
            <div className="rounded-md border border-emerald-200/60 bg-emerald-50/30 p-2 dark:bg-emerald-950/20">
              <p className="font-medium text-emerald-900 dark:text-emerald-100">Customer-safe preview</p>
              <p className="text-muted-foreground">Active: {safePreview.statuses.find((s) => s.active)?.label}</p>
              <p className="text-[10px] text-muted-foreground">
                Internal owner / blocker / escalation labels are not exposed in customer projections.
              </p>
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
