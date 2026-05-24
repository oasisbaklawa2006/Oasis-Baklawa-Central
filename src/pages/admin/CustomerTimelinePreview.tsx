import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CustomerOrderTimeline } from "@/components/customer/CustomerOrderTimeline";

/**
 * Internal staff preview of the customer-facing timeline component.
 * Not linked from public marketing — navigate via admin sidebar or direct URL.
 */
export default function CustomerTimelinePreview() {
  return (
    <div className="mx-auto max-w-lg space-y-6 p-4">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-bold tracking-tight">Customer timeline preview</h1>
          <Badge variant="secondary" className="text-[10px] uppercase">
            Staff only
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Curated milestones for customer communications. This is not wired to live order state yet.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Example journey</CardTitle>
          <CardDescription className="text-xs">
            No raw operational logs, finance internals, or dispatch panic signals are shown here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CustomerOrderTimeline />
        </CardContent>
      </Card>
    </div>
  );
}
