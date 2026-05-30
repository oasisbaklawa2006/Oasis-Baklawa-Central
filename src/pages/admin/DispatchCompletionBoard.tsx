import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Truck, ShieldCheck, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  FORBIDDEN_COMPLETION_ACTIONS,
  projectDispatchCompletion,
  type DispatchCompletionInput,
  type DispatchCompletionProjection,
} from "@/lib/dispatch-completion";
import { financeSignalLabel } from "@/lib/dispatch-readiness/financeDispatchSignal";
import {
  createDispatchCompletionBundle,
  type DispatchCompletionBundle,
} from "@/lib/dispatch-completion/createDispatchCompletionBundle";
import { OperationalTimeline } from "@/components/admin/OperationalTimeline";
import { GovernanceBoardLiveNotice } from "@/components/admin/GovernanceBoardLiveNotice";
import { GovernancePrerequisiteList } from "@/components/admin/GovernancePrerequisiteList";
import type { OperationalEventRecord } from "@/lib/operational-events/types";
import {
  loadDispatchCompletionRows,
  PREVIEW_COMPLETION_INPUTS,
  useGovernanceBoardState,
} from "@/lib/execution-read-models";

export const FORBIDDEN_COMPLETION_UI_LABELS = [
  "Mark Dispatched",
  "Dispatch Complete",
  "Update Order Status",
  "Generate Invoice",
  "E-Way",
  "Capture Payment",
  "Deduct Stock",
] as const;

const PREVIEW_ROWS = PREVIEW_COMPLETION_INPUTS.map((input) => ({
  input,
  missingSignals: [] as string[],
}));

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
  missingSignals,
  onReview,
  onAttest,
  busy,
  canWrite,
}: {
  input: DispatchCompletionInput;
  projection: DispatchCompletionProjection;
  missingSignals: string[];
  onReview: () => void;
  onAttest: () => void;
  busy: boolean;
  canWrite: boolean;
}) {
  const prereqChecks = [
    { label: "Readiness gate_eligible", ok: input.readinessStatus === "gate_eligible" },
    { label: "Finance signal ready", ok: input.financeSignal === "ready" },
    {
      label: "Finance commercially released",
      ok:
        input.financeReleaseStatus === "commercially_released" ||
        input.financeReleaseStatus === "finance_conditionally_ready",
    },
    { label: "Reservation ready", ok: input.reservationReady },
    { label: "Security gate passed", ok: input.securityGatePassed },
    { label: "Courier manifest on file", ok: input.courierManifestAttached },
    { label: "Order not yet dispatched", ok: !input.orderAlreadyDispatched },
  ];

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
        <GovernancePrerequisiteList
          title="Completion blockers"
          items={projection.blockingReasons}
          variant={projection.blockingReasons.length > 0 ? "destructive" : "default"}
        />
        {missingSignals.length > 0 && (
          <GovernancePrerequisiteList title="Missing live signals" items={missingSignals} variant="destructive" />
        )}
        <div className="rounded-md border border-border/60 bg-muted/30 p-2 text-xs">
          <p className="mb-2 font-medium">Prerequisite checklist</p>
          <ul className="space-y-1">
            {prereqChecks.map(({ label, ok }) => (
              <li key={label} className={ok ? "text-muted-foreground" : "text-destructive"}>
                {ok ? "✓" : "✗"} {label}
              </li>
            ))}
          </ul>
        </div>
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
          <Button type="button" size="sm" variant="outline" disabled={busy || !canWrite} onClick={onReview}>
            Step 1 — Review completion (evidence)
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={busy || !canWrite || projection.completionStatus !== "completion_eligible"}
            onClick={onAttest}
          >
            Step 2 — Attest completion (governed)
          </Button>
        </div>
        {projection.completionStatus !== "completion_eligible" && (
          <p className="text-[10px] text-muted-foreground">
            Complete Step 1 and upstream 4B/4C boards first. Attestation does not set orders.status to dispatched.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function DispatchCompletionBoard() {
  const { user, role } = useAuth();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [timelineOrderId, setTimelineOrderId] = useState<string | null>(null);
  const [events, setEvents] = useState<OperationalEventRecord[]>([]);
  const [bundle, setBundle] = useState<DispatchCompletionBundle | null>(null);

  const boardState = useGovernanceBoardState(
    supabase,
    loadDispatchCompletionRows,
    PREVIEW_ROWS,
    ["orders", "dispatch_completion_evidence", "operational_scan_records"],
  );

  useEffect(() => {
    let cancelled = false;
    void createDispatchCompletionBundle(supabase)
      .then((b) => {
        if (!cancelled) setBundle(b);
      })
      .catch(() => {
        if (!cancelled) setBundle(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const cardSources = useMemo(() => {
    if (boardState.liveRows.length > 0) {
      return boardState.liveRows.map((row) => ({
        input: row.input,
        missingSignals: row.missingSignals,
        projection: projectDispatchCompletion(row.input),
      }));
    }
    if (boardState.showPreviewCards) {
      return PREVIEW_COMPLETION_INPUTS.map((input) => ({
        input,
        missingSignals: [] as string[],
        projection: projectDispatchCompletion(input),
      }));
    }
    return [];
  }, [boardState.liveRows, boardState.showPreviewCards]);

  const writeCtx = (orderId: string) => ({
    correlationId: `completion-${orderId}-${Date.now()}`,
    actorUserId: user?.id ?? "",
    actorRole: role ?? "DISPATCH_MANAGER",
    overrideReason: role === "SUPER_ADMIN" ? "Governed completion review" : null,
    attestationReason: "Governed attestation — append-only evidence",
  });

  const refreshEvents = async (orderId: string) => {
    if (!bundle?.canExecuteWrites) return;
    setTimelineOrderId(orderId);
    const evts = await bundle.service.listEvents(orderId);
    setEvents(completionEventsToOperational(evts));
  };

  const handleReview = async (input: DispatchCompletionInput) => {
    if (!user?.id || !role || !bundle?.canExecuteWrites) return;
    setBusyId(input.orderId);
    try {
      await bundle.service.reviewCompletion(input, writeCtx(input.orderId));
      await refreshEvents(input.orderId);
      boardState.reload();
    } finally {
      setBusyId(null);
    }
  };

  const handleAttest = async (input: DispatchCompletionInput) => {
    if (!user?.id || !role || !bundle?.canExecuteWrites) return;
    setBusyId(input.orderId);
    try {
      await bundle.service.attestCompletion(input, writeCtx(input.orderId));
      await refreshEvents(input.orderId);
      boardState.reload();
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
        {bundle && (
          <Badge variant="outline" className="text-[10px]">
            {bundle.persistenceMode}
          </Badge>
        )}
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

      <GovernanceBoardLiveNotice
        meta={boardState.meta}
        loading={boardState.loading}
        loadError={boardState.loadError}
        showEmptyLiveMessage={boardState.showEmptyLiveMessage}
        showUnavailableMessage={boardState.showUnavailableMessage}
        showPreviewCards={boardState.showPreviewCards}
      />

      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="flex gap-2 pt-4 text-sm">
          <ShieldCheck className="h-5 w-5 shrink-0 text-amber-600" aria-hidden />
          <p>
            <strong>completion_attested</strong> records append-only governance evidence. It does{" "}
            <strong>not</strong> set <code>orders.status</code> to dispatched, deduct stock, or generate invoices.
          </p>
        </CardContent>
      </Card>

      <section className="grid gap-4 md:grid-cols-2">
        {cardSources.map(({ input, projection, missingSignals }) => (
          <CompletionCard
            key={input.orderId}
            input={input}
            projection={projection}
            missingSignals={missingSignals}
            busy={busyId === input.orderId}
            canWrite={bundle?.canExecuteWrites ?? false}
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
