import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Truck, ShieldCheck, AlertTriangle, PackageCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import {
  FORBIDDEN_FINALIZATION_UI_PATTERNS,
  projectDispatchRelease,
  type DispatchFinalizationInput,
  type DispatchReleaseProjection,
} from "@/lib/dispatch-finalization";
import {
  createDispatchFinalizationService,
  createInMemoryDispatchFinalizationEventSink,
} from "@/lib/dispatch-finalization/dispatchFinalizationService";
import {
  createInMemoryDispatchLineageStore,
  createInMemoryOrderDispatchStatusRepository,
} from "@/lib/dispatch-finalization/inMemoryDispatchFinalizationStore";
import { OperationalTimeline } from "@/components/admin/OperationalTimeline";
import type { OperationalEventRecord } from "@/lib/operational-events/types";
import { lineageReleaseTypeLabel } from "@/lib/dispatch-finalization/dispatchLineage";

export const FORBIDDEN_FINALIZATION_UI_LABELS = [
  "Capture Payment",
  "Generate Invoice",
  "E-Way API",
  "Auto Dispatch",
  "Deduct Stock",
  "Force Release",
] as const;

const SAMPLE_READY: DispatchFinalizationInput = {
  orderId: "00000000-0000-4000-8000-000000000501",
  currentOrderStatus: "cleared_for_dispatch",
  readinessStatus: "gate_eligible",
  financeSignal: "ready",
  financeReleaseStatus: "commercially_released",
  completionStatus: "completion_attested",
  reservationReady: true,
  transporterHandoffFinalized: true,
  gateReference: "gate-scan-501",
  completionReference: "attest-501",
  transporterReference: "Delhivery / AWB-501",
  openReleaseBlockers: [],
};

const SAMPLE_BLOCKED: DispatchFinalizationInput = {
  orderId: "00000000-0000-4000-8000-000000000502",
  currentOrderStatus: "packed_ready",
  readinessStatus: "partially_ready",
  financeSignal: "blocked",
  financeReleaseStatus: "finance_hold",
  completionStatus: "prerequisites_pending",
  reservationReady: false,
  transporterHandoffFinalized: false,
  gateReference: null,
  completionReference: null,
  transporterReference: null,
  openReleaseBlockers: ["awaiting_supervisor"],
};

function finalizationEventsToOperational(
  records: {
    id: string;
    title: string;
    message: string;
    occurredAt: string;
    eventType: string;
    orderId: string;
    visibility: string;
  }[],
): OperationalEventRecord[] {
  return records.map((e, i) => ({
    id: e.id,
    kind: e.eventType,
    category: "dispatch" as const,
    severity: e.visibility === "customer_safe" ? ("info" as const) : ("info" as const),
    title: e.title,
    detail: e.message,
    occurredAt: e.occurredAt,
    sortKey: i,
    source: "manual" as const,
    actor: { role: "dispatch" as const, displayLabel: "Dispatch finalization" },
    entities: [{ entityType: "order" as const, id: e.orderId }],
  }));
}

function ReleaseCard({
  input,
  projection,
  onFinalize,
  onPublish,
  onReversal,
  busy,
  customerPreview,
}: {
  input: DispatchFinalizationInput;
  projection: DispatchReleaseProjection;
  onFinalize: () => void;
  onPublish: () => void;
  onReversal: () => void;
  busy: boolean;
  customerPreview: { label: string }[];
}) {
  const lane = projection.canFinalize ? "eligible" : projection.releaseStatus === "dispatch_release_blocked" ? "blocked" : "pending";

  return (
    <Card className={lane === "eligible" ? "ring-1 ring-primary/30" : "ring-1 ring-border/50"}>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2">
        <CardTitle className="text-sm font-semibold">Order {input.orderId.slice(-4)}</CardTitle>
        <Badge variant={projection.canFinalize ? "default" : "secondary"}>
          {projection.releaseStatus.replace(/_/g, " ")}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">{projection.releaseRecommendation}</p>
        {projection.blockingReasons.length > 0 && (
          <ul className="list-inside list-disc text-xs text-destructive">
            {projection.blockingReasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        )}
        {customerPreview.length > 0 && (
          <div className="rounded-md border border-border/60 bg-muted/30 p-2 text-xs">
            <p className="font-medium">Customer publication preview</p>
            {customerPreview.map((s) => (
              <span key={s.label} className="mr-2 inline-block">
                {s.label}
              </span>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" disabled={busy || !projection.canFinalize} onClick={onFinalize}>
            Finalize dispatch (governed)
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={busy || !projection.canPublishCustomerRelease}
            onClick={onPublish}
          >
            Publish customer release
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy || projection.releaseStatus !== "dispatch_finalized"}
            onClick={onReversal}
          >
            Request reversal
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DispatchFinalizationBoard() {
  const { user, role } = useAuth();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [timelineOrderId, setTimelineOrderId] = useState<string | null>(null);
  const [events, setEvents] = useState<OperationalEventRecord[]>([]);
  const [lineageLabels, setLineageLabels] = useState<string[]>([]);
  const [liveStatusByOrder, setLiveStatusByOrder] = useState<Record<string, string>>({});

  const ordersRepo = useMemo(
    () =>
      createInMemoryOrderDispatchStatusRepository({
        [SAMPLE_READY.orderId]: { status: "cleared_for_dispatch" },
        [SAMPLE_BLOCKED.orderId]: { status: "packed_ready" },
      }),
    [],
  );

  const service = useMemo(
    () =>
      createDispatchFinalizationService({
        lineage: createInMemoryDispatchLineageStore(),
        orders: ordersRepo,
        events: createInMemoryDispatchFinalizationEventSink(),
      }),
    [ordersRepo],
  );

  const cards = useMemo(
    () =>
      [SAMPLE_READY, SAMPLE_BLOCKED].map((input) => {
        const merged: DispatchFinalizationInput = {
          ...input,
          currentOrderStatus: liveStatusByOrder[input.orderId] ?? input.currentOrderStatus,
        };
        return {
          input: merged,
          projection: projectDispatchRelease(merged),
          preview: service.previewCustomerPublication(merged.orderId, merged.transporterReference ?? undefined),
        };
      }),
    [service, liveStatusByOrder],
  );

  const writeCtx = (orderId: string, extra?: { reversalReason?: string }) => ({
    correlationId: `fin-${orderId}-${Date.now()}`,
    actorUserId: user?.id ?? "",
    actorRole: role ?? "DISPATCH_HEAD",
    finalizeReason: "Staging governed finalize — Phase 4E",
    overrideReason: role === "SUPER_ADMIN" ? "Staging finalization override" : null,
    ...extra,
  });

  const refresh = async (orderId: string) => {
    setTimelineOrderId(orderId);
    const evts = await service.listEvents(orderId);
    setEvents(finalizationEventsToOperational(evts));
    const lin = await service.listLineage(orderId);
    setLineageLabels(lin.map((l) => `${lineageReleaseTypeLabel(l.releaseType)}: ${l.previousStatus}→${l.nextStatus}`));
  };

  const handleFinalize = async (input: DispatchFinalizationInput) => {
    if (!user?.id) return;
    setBusyId(input.orderId);
    try {
      const result = await service.finalizeDispatch(input, writeCtx(input.orderId), {
        trackingNumber: "LR-STAGING-4E",
        courierName: input.transporterReference?.split("/")[0]?.trim(),
      });
      setLiveStatusByOrder((prev) => ({ ...prev, [input.orderId]: result.statusUpdate.nextStatus }));
      await refresh(input.orderId);
    } finally {
      setBusyId(null);
    }
  };

  const handlePublish = async (input: DispatchFinalizationInput) => {
    if (!user?.id) return;
    setBusyId(input.orderId);
    try {
      await service.publishCustomerRelease(input.orderId, writeCtx(input.orderId), input.transporterReference ?? undefined);
      await refresh(input.orderId);
    } finally {
      setBusyId(null);
    }
  };

  const handleReversal = async (input: DispatchFinalizationInput) => {
    if (!user?.id) return;
    setBusyId(input.orderId);
    try {
      await service.requestDispatchReversal(input.orderId, {
        ...writeCtx(input.orderId),
        reversalReason: "Staging reversal drill",
      });
      await service.completeDispatchReversal(input.orderId, {
        ...writeCtx(input.orderId),
        reversalReason: "Staging reversal drill",
      });
      await refresh(input.orderId);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 pb-24">
      <header className="flex flex-wrap items-center gap-2 border-b border-border pb-4">
        <Truck className="h-7 w-7 text-primary" aria-hidden />
        <h1 className="text-xl font-bold tracking-tight">Dispatch finalization</h1>
        <Badge variant="outline" className="text-[10px] uppercase">
          Phase 4E — governed status mutation
        </Badge>
        <Link to="/admin/dispatch-completion" className="text-xs text-primary underline-offset-2 hover:underline">
          Completion (4D)
        </Link>
        <Link to="/admin/dispatch-readiness" className="text-xs text-primary underline-offset-2 hover:underline">
          Readiness (4B)
        </Link>
      </header>

      <Card className="border-emerald-500/30 bg-emerald-500/5">
        <CardContent className="flex gap-2 pt-4 text-sm">
          <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
          <p>
            First auditable path to <strong>orders.status → dispatched</strong>. Requires 4B gate, 4C commercial
            release, 4D attestation, and transporter handoff. No payment, invoice, notifications, or stock deduction.
          </p>
        </CardContent>
      </Card>

      <section className="grid gap-4 md:grid-cols-2">
        {cards.map(({ input, projection, preview }) => (
          <ReleaseCard
            key={input.orderId}
            input={input}
            projection={projection}
            busy={busyId === input.orderId}
            customerPreview={preview}
            onFinalize={() => void handleFinalize(input)}
            onPublish={() => void handlePublish(input)}
            onReversal={() => void handleReversal(input)}
          />
        ))}
      </section>

      {lineageLabels.length > 0 && timelineOrderId && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <PackageCheck className="h-4 w-4" aria-hidden />
              Release lineage — …{timelineOrderId.slice(-4)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-inside list-disc text-xs text-muted-foreground">
              {lineageLabels.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <AlertTriangle className="h-4 w-4 text-muted-foreground" aria-hidden />
            Forbidden in Phase 4E
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2 text-xs">
          {FORBIDDEN_FINALIZATION_UI_LABELS.map((label) => (
            <Badge key={label} variant="outline">
              {label}
            </Badge>
          ))}
          {FORBIDDEN_FINALIZATION_UI_PATTERNS.map((p) => (
            <Badge key={p} variant="destructive" className="font-mono text-[10px]">
              {p}
            </Badge>
          ))}
        </CardContent>
      </Card>

      {timelineOrderId && events.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold">Finalization events</h2>
          <OperationalTimeline events={events} />
        </section>
      )}
    </div>
  );
}
