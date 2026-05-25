import { useState } from "react";
import { ShieldAlert, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CustomerOrderTimeline } from "@/components/customer/CustomerOrderTimeline";
import { useCustomerTimelinePreview } from "@/hooks/useCustomerTimelinePreview";
import type { CustomerTimelineStepState } from "@/components/customer/CustomerOrderTimeline";

/**
 * Staff-only preview of customer-safe timeline derived from operational_events.
 * NOT publicly released — no customer route, no notifications.
 */
export default function CustomerTimelinePreview() {
  const { loading, error, projection, publicContract, loadByOrderId } = useCustomerTimelinePreview();
  const [orderId, setOrderId] = useState("");
  const [soRef, setSoRef] = useState("");

  const uiSteps =
    projection?.steps.map((s) => ({
      id: s.code,
      label: s.label,
      state: (s.completed ? "completed" : s.active ? "current" : "upcoming") as CustomerTimelineStepState,
      caption: s.description,
    })) ?? [];

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 pb-24">
      <header className="space-y-2 border-b border-border pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-bold tracking-tight">Customer timeline preview</h1>
          <Badge variant="secondary" className="text-[10px] uppercase">
            Staff only
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Event-derived, customer-safe projection. Raw operational titles and messages are never shown to
          customers.
        </p>
      </header>

      <Card className="border-amber-500/40 bg-amber-500/5">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm text-amber-900 dark:text-amber-100">
            <ShieldAlert className="h-4 w-4" aria-hidden />
            Not publicly released
          </CardTitle>
          <CardDescription className="text-xs">
            This preview is for internal validation only. No customer app route, public API, or notification
            actions are enabled in Phase 3H.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Load by order</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Input
            placeholder="Order UUID"
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            className="h-10 min-w-[240px] flex-1"
          />
          <Input
            placeholder="SO / public ref (optional)"
            value={soRef}
            onChange={(e) => setSoRef(e.target.value)}
            className="h-10 w-40"
          />
          <Button
            type="button"
            size="sm"
            disabled={loading}
            onClick={() => void loadByOrderId(orderId, soRef || undefined)}
          >
            <Search className="mr-1 h-3.5 w-3.5" aria-hidden />
            Project
          </Button>
        </CardContent>
      </Card>

      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      {projection ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Narrative summary</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-xs sm:grid-cols-2">
              <p>
                <span className="text-muted-foreground">Current status:</span> {projection.currentStatus}
              </p>
              <p>
                <span className="text-muted-foreground">Progress:</span> {projection.progressPercent}%
              </p>
              <p>
                <span className="text-muted-foreground">Suppressed events:</span>{" "}
                {projection.suppressedEventCount} / {projection.derivedFromEventCount}
              </p>
              <p>
                <span className="text-muted-foreground">Complaint:</span> {projection.complaintState}
              </p>
              <p className="sm:col-span-2">
                <span className="text-muted-foreground">Safe detail:</span> {projection.safeDetail ?? "—"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Customer-safe steps</CardTitle>
            </CardHeader>
            <CardContent>
              <CustomerOrderTimeline steps={uiSteps} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Mapping explanations (staff)</CardTitle>
            </CardHeader>
            <CardContent className="max-h-48 space-y-1 overflow-y-auto text-[10px] font-mono">
              {projection.mappingExplanations.map((m, i) => (
                <p key={i}>
                  {m.eventType} → {m.mappedTo ?? "—"} {m.suppressed ? "[suppressed]" : ""} — {m.reason}
                </p>
              ))}
            </CardContent>
          </Card>

          {publicContract ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Public contract preview (future app)</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                <pre className="max-h-40 overflow-auto rounded bg-muted p-2 text-[10px]">
                  {JSON.stringify(publicContract, null, 2)}
                </pre>
              </CardContent>
            </Card>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
