import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Truck, ShieldCheck, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import {
  FORBIDDEN_COMPLETION_ACTIONS,
  projectDispatchCompletion,
  type DispatchCompletionInput,
  type DispatchCompletionProjection,
} from "@/lib/dispatch-completion";
import { financeSignalLabel } from "@/lib/dispatch-readiness/financeDispatchSignal";
import {
  createDispatchCompletionService,
  createInMemoryDispatchCompletionEvidenceStore,
  createInMemoryDispatchCompletionEventSink,
} from "@/lib/dispatch-completion";
import { OperationalTimeline } from "@/components/admin/OperationalTimeline";
import type { OperationalEventRecord } from "@/lib/operational-events/types";

export const FORBIDDEN_COMPLETION_UI_LABELS = [
  "Mark Dispatched",
  "Dispatch Complete",
  "Update Order Status",
  "Generate Invoice",
  "E-Way",
  "Capture Payment",
  "Deduct Stock",
] as const;

const SAMPLE: DispatchCompletionInput[] = [
  {
    orderId: "00000000-0000-4000-8000-000000000301",
    queueItemId: "q-d1",
    readinessStatus: "gate_eligible",
    financeSignal: "ready",
    financeReleaseStatus: "commercially_released",
    reservationReady: true,
    orderAlreadyDispatched: false,
    securityGatePassed: true,
    courierManifestAttached: true,
    openCompletionHolds: [],
  },
  {
    orderId: "00000000-0000-4000-8000-000000000302",
    queueItemId: "q-d2",
    readinessStatus: "partially_ready",
    financeSignal: "blocked",
    financeReleaseStatus: "finance_hold",
    reservationReady: false,
    orderAlreadyDispatched: false,
    securityGatePassed: false,
    courierManifestAttached: false,
    openCompletionHolds: ["supervisor_review_required"],
  },
];

function completionEventsToOperational(
  records: {
    id: string;
    title: string;
    message: string;
    occurredAt: string;
    eventType: string;
    orderId: string;
  }[],
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
    actor: { role: "dispatch" as const, displayLabel: "Dispatch completion governance" },
    entities: [{ entityType: "order" as const, id: e.orderId }],
  }));
}

function CompletionCard({
  input,
  projection,
  onReview,
  onAttest,
  busy,
}: {
  input: DispatchCompletionInput;
  projection: DispatchCompletionProjection;
  onReview: () => void;
  onAttest: () => void;
  busy: boolean;
}) {
  return (
    <Card className="shadow-none ring-1 ring-border/50">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2">
        <CardTitle className="text-sm font-semibold">Order {input.orderId.slice(-4)}</CardTitle>
        <Badge variant={projection.completionStatus === "completion_eligible" ? "default" : "secondary"}>
          {projection.completionStatus.replace(/_/g, " ")}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">{projection.completionRecommendation}</p>
        {projection.warnings.length > 0 && (
          <ul className="list-inside list-disc text-xs text-amber-700 dark:text-amber-400">
            {projection.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span>Readiness: {input.readinessStatus}</span>
          <span>Finance: {financeSignalLabel(input.financeSignal)}</span>
          <span>Release: {input.financeReleaseStatus}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={onReview}>
            Review completion (evidence)
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={busy || projection.completionStatus !== "completion_eligible"}
            onClick={onAttest}
          >
            Attest completion (governed)
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DispatchCompletionBoard() {
  const { user, role } = useAuth();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [timelineOrderId, setTimelineOrderId] = useState<string | null>(null);
  const [events, setEvents] = useState<OperationalEventRecord[]>([]);

  const service = useMemo(
    () =>
      createDispatchCompletionService({
        evidence: createInMemoryDispatchCompletionEvidenceStore(),
        events: createInMemoryDispatchCompletionEventSink(),
      }),
    [],
  );

  const cards = useMemo(() => SAMPLE.map((input) => ({ input, projection: projectDispatchCompletion(input) })), []);

  const writeCtx = (orderId: string) => ({
    correlationId: `completion-local-${orderId}-${Date.now()}`,
    actorUserId: user?.id ?? "",
    actorRole: role ?? "DISPATCH_MANAGER",
    overrideReason: role === "SUPER_ADMIN" ? "Staging completion governance" : null,
    attestationReason: "Governed staging attestation — append-only evidence",
  });

  const refreshEvents = async (orderId: string) => {
    setTimelineOrderId(orderId);
    const evts = await service.listEvents(orderId);
    setEvents(completionEventsToOperational(evts));
  };

  const handleReview = async (input: DispatchCompletionInput) => {
    if (!user?.id || !role) return;
    setBusyId(input.orderId);
    try {
      await service.reviewCompletion(input, writeCtx(input.orderId));
      await refreshEvents(input.orderId);
    } finally {
      setBusyId(null);
    }
  };

  const handleAttest = async (input: DispatchCompletionInput) => {
    if (!user?.id || !role) return;
    setBusyId(input.orderId);
    try {
      await service.attestCompletion(input, writeCtx(input.orderId));
      await refreshEvents(input.orderId);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 pb-24">
      <header className="flex flex-wrap items-center gap-2 border-b border-border pb-4">
        <Truck className="h-7 w-7 text-primary" aria-hidden />
        <h1 className="text-xl font-bold tracking-tight">Dispatch completion governance</h1>
        <Badge variant="outline" className="text-[10px] uppercase">
          Phase 4D — attestation only
        </Badge>
        <Link to="/admin/dispatch-readiness" className="text-xs text-primary underline-offset-2 hover:underline">
          Dispatch readiness (4B)
        </Link>
        <Link to="/admin/finance-governance" className="text-xs text-primary underline-offset-2 hover:underline">
          Finance governance (4C)
        </Link>
        <Link
          to="/admin/dispatch-finalization"
          className="text-xs text-primary underline-offset-2 hover:underline"
        >
          Finalization (4E)
        </Link>
      </header>

      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="flex gap-2 pt-4 text-sm">
          <ShieldCheck className="h-5 w-5 shrink-0 text-amber-600" aria-hidden />
          <p>
            <strong>completion_attested</strong> records append-only governance evidence. It does{" "}
            <strong>not</strong> set <code>orders.status</code> to dispatched, deduct stock, or generate invoices.
            Downstream mutation requires a separate authority PR.
          </p>
        </CardContent>
      </Card>

      <section className="grid gap-4 md:grid-cols-2">
        {cards.map(({ input, projection }) => (
          <CompletionCard
            key={input.orderId}
            input={input}
            projection={projection}
            busy={busyId === input.orderId}
            onReview={() => void handleReview(input)}
            onAttest={() => void handleAttest(input)}
          />
        ))}
      </section>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <AlertTriangle className="h-4 w-4 text-muted-foreground" aria-hidden />
            Forbidden in Phase 4D
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2 text-xs">
          {FORBIDDEN_COMPLETION_UI_LABELS.map((label) => (
            <Badge key={label} variant="outline">
              {label}
            </Badge>
          ))}
          {FORBIDDEN_COMPLETION_ACTIONS.map((a) => (
            <Badge key={a} variant="destructive" className="font-mono text-[10px]">
              {a}
            </Badge>
          ))}
        </CardContent>
      </Card>

      {timelineOrderId && events.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold">Completion events — order …{timelineOrderId.slice(-4)}</h2>
          <OperationalTimeline events={events} />
        </section>
      )}
    </div>
  );
}
