import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Truck, ShieldCheck, AlertTriangle, ClipboardCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import {
  DISPATCH_EXCEPTION_LABELS,
  FORBIDDEN_DISPATCH_ACTIONS,
  projectDispatchReadiness,
  type DispatchReadinessInput,
  type DispatchReadinessProjection,
} from "@/lib/dispatch-readiness";
import { financeSignalLabel } from "@/lib/dispatch-readiness/financeDispatchSignal";
import {
  createInMemoryDispatchEvidenceStore,
  createDispatchReadinessService,
  createInMemoryDispatchEventSink,
} from "@/lib/dispatch-readiness";
import { OperationalTimeline } from "@/components/admin/OperationalTimeline";
import type { OperationalEventRecord } from "@/lib/operational-events/types";

/** Labels that must never appear as actions in Phase 4B UI. */
export const FORBIDDEN_DISPATCH_UI_LABELS = [
  "Dispatch Complete",
  "Mark Dispatched",
  "Generate Invoice",
  "E-Way",
  "Capture Payment",
  "Final Release",
] as const;

const SAMPLE_ORDERS: DispatchReadinessInput[] = [
  {
    orderId: "00000000-0000-4000-8000-000000000101",
    queue: { queueItemId: "q-1", isActive: true, isCompleted: false, hasVersionConflict: false },
    scan: {
      hasUnresolvedMismatch: false,
      hasRejectedGateScan: false,
      gateScanVerified: true,
      cartonBarcodeVerified: true,
    },
    reservationStatus: "reserved",
    financeSignal: "ready",
    packingEvidenceVerified: true,
    documentPlaceholderPresent: true,
    openExceptionTypes: [],
  },
  {
    orderId: "00000000-0000-4000-8000-000000000102",
    queue: { queueItemId: "q-2", isActive: true, isCompleted: false, hasVersionConflict: false },
    scan: {
      hasUnresolvedMismatch: true,
      hasRejectedGateScan: false,
      gateScanVerified: false,
      cartonBarcodeVerified: false,
    },
    reservationStatus: "pending",
    financeSignal: "blocked",
    packingEvidenceVerified: false,
    documentPlaceholderPresent: false,
    openExceptionTypes: ["dispatch_barcode_mismatch"],
  },
];

function dispatchEventsToOperational(
  records: { id: string; title: string; message: string; occurredAt: string; eventType: string; orderId: string }[],
): OperationalEventRecord[] {
  return records.map((e, i) => ({
    id: e.id,
    kind: e.eventType,
    category: "dispatch" as const,
    severity: "info" as const,
    title: e.title,
    detail: e.message,
    occurredAt: e.occurredAt,
    sortKey: i,
    source: "manual" as const,
    actor: { role: "dispatch" as const, displayLabel: "Dispatch readiness" },
    entities: [{ entityType: "order" as const, id: e.orderId }],
  }));
}

function ReadinessCard({
  input,
  projection,
  onReview,
  reviewing,
}: {
  input: DispatchReadinessInput;
  projection: DispatchReadinessProjection;
  onReview: () => void;
  reviewing: boolean;
}) {
  return (
    <Card className="shadow-none ring-1 ring-border/50">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2">
        <CardTitle className="text-sm font-semibold">Order {input.orderId.slice(-4)}</CardTitle>
        <div className="flex flex-wrap gap-1">
          <Badge variant={projection.readinessStatus === "gate_eligible" ? "default" : "secondary"}>
            {projection.readinessStatus.replace(/_/g, " ")}
          </Badge>
          <Badge variant="outline">{projection.gateEligibility.replace(/_/g, " ")}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">{projection.safeStaffRecommendation}</p>
        <div>
          <p className="text-xs font-medium uppercase text-muted-foreground">Missing requirements</p>
          <ul className="mt-1 list-inside list-disc text-xs">
            {projection.missingRequirements.length === 0 ? (
              <li className="text-muted-foreground">None</li>
            ) : (
              projection.missingRequirements.map((m) => <li key={m}>{m}</li>)
            )}
          </ul>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span>Reservation: {input.reservationStatus}</span>
          <span>Finance: {financeSignalLabel(input.financeSignal)}</span>
          <span>Gate scan: {input.scan.gateScanVerified ? "verified" : "pending"}</span>
        </div>
        {projection.openExceptions.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {projection.openExceptions.map((ex) => (
              <Badge key={ex} variant="destructive" className="text-[10px]">
                {DISPATCH_EXCEPTION_LABELS[ex]}
              </Badge>
            ))}
          </div>
        )}
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={reviewing || projection.readinessStatus === "not_ready"}
          onClick={onReview}
        >
          Ready for Review (event only)
        </Button>
      </CardContent>
    </Card>
  );
}

export default function DispatchReadinessBoard() {
  const { user, role } = useAuth();
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [timelineOrderId, setTimelineOrderId] = useState<string | null>(null);

  const service = useMemo(
    () =>
      createDispatchReadinessService({
        evidence: createInMemoryDispatchEvidenceStore(),
        events: createInMemoryDispatchEventSink(),
      }),
    [],
  );

  const projections = useMemo(
    () => SAMPLE_ORDERS.map((o) => ({ input: o, projection: projectDispatchReadiness(o) })),
    [],
  );

  const [events, setEvents] = useState<OperationalEventRecord[]>([]);

  const handleReview = async (input: DispatchReadinessInput) => {
    if (!user?.id || !role) return;
    setReviewingId(input.orderId);
    try {
      const listed = await service.reviewReadiness(input, {
        correlationId: `review-local-${Date.now()}`,
        actorUserId: user.id,
        actorRole: role,
        overrideReason: role === "SUPER_ADMIN" ? "Staging readiness review" : null,
      });
      setTimelineOrderId(input.orderId);
      const evts = await service.listEvents(input.orderId);
      setEvents(dispatchEventsToOperational(evts));
      void listed.projection;
    } finally {
      setReviewingId(null);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 pb-24">
      <header className="flex flex-wrap items-center gap-2 border-b border-border pb-4">
        <Truck className="h-7 w-7 text-primary" aria-hidden />
        <h1 className="text-xl font-bold tracking-tight">Dispatch readiness</h1>
        <Badge variant="outline" className="text-[10px] uppercase">
          Gate eligibility only
        </Badge>
        <Link to="/admin/dispatch-mgmt" className="text-xs text-primary underline-offset-2 hover:underline">
          Dispatch operations
        </Link>
      </header>

      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="flex gap-2 pt-4 text-sm">
          <ShieldCheck className="h-5 w-5 shrink-0 text-amber-600" aria-hidden />
          <p>
            <strong>gate_eligible</strong> is not dispatched. This board records readiness review events only —
            no mark dispatched, invoice, e-way, or stock deduction.
          </p>
        </CardContent>
      </Card>

      <section className="grid gap-4 md:grid-cols-2">
        {projections.map(({ input, projection }) => (
          <ReadinessCard
            key={input.orderId}
            input={input}
            projection={projection}
            reviewing={reviewingId === input.orderId}
            onReview={() => void handleReview(input)}
          />
        ))}
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <AlertTriangle className="h-4 w-4" />
            Exception lane
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          Exceptions are queue/event projections only — see{" "}
          <Link to="/admin/live-work-queues" className="text-primary underline">
            Live work queues
          </Link>
          . Forbidden actions: {FORBIDDEN_DISPATCH_ACTIONS.join(", ")}.
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <ClipboardCheck className="h-4 w-4" />
            Evidence timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <OperationalTimeline
            events={events}
            showFilters={false}
            defaultFilter="dispatch"
            ariaLabel="Dispatch readiness evidence timeline"
          />
        </CardContent>
      </Card>

      <p className="text-[10px] text-muted-foreground">
        UI guard: no {FORBIDDEN_DISPATCH_UI_LABELS.join(", ")} controls rendered.
      </p>
    </div>
  );
}
