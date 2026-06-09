import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Truck, ShieldCheck, AlertTriangle, ClipboardCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  DISPATCH_EXCEPTION_LABELS,
  FORBIDDEN_DISPATCH_ACTIONS,
  projectDispatchReadiness,
  type DispatchReadinessInput,
  type DispatchReadinessProjection,
  type DispatchReadinessWriteContext,
} from "@/lib/dispatch-readiness";
import { financeSignalLabel } from "@/lib/dispatch-readiness/financeDispatchSignal";
import { createDispatchReadinessBundle, type DispatchReadinessBundle } from "@/lib/dispatch-readiness/createDispatchReadinessBundle";
import { OperationalTimeline } from "@/components/admin/OperationalTimeline";
import { GovernanceBoardLiveNotice } from "@/components/admin/GovernanceBoardLiveNotice";
import {
  governanceWritesBlocked,
  OperationalStatusLabel,
} from "@/components/admin/OperationalStatusLabel";
import { DispatchReadinessEvidencePanel } from "@/components/admin/DispatchReadinessEvidencePanel";
import { GovernancePrerequisiteList } from "@/components/admin/GovernancePrerequisiteList";
import type { OperationalEventRecord } from "@/lib/operational-events/types";
import {
  loadDispatchReadinessRows,
  PREVIEW_READINESS_INPUTS,
  useGovernanceBoardState,
} from "@/lib/execution-read-models";

/** Labels that must never appear as actions in Phase 4B UI. */
export const FORBIDDEN_DISPATCH_UI_LABELS = [
  "Dispatch Complete",
  "Mark Dispatched",
  "Generate Invoice",
  "E-Way",
  "Capture Payment",
  "Final Release",
] as const;

const PREVIEW_ROWS = PREVIEW_READINESS_INPUTS.map((input) => ({
  input,
  missingSignals: [] as string[],
}));

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
  missingSignals,
  onReview,
  reviewing,
  canWrite,
  bundle,
  writeCtx,
  onEvidenceRecorded,
  showPreviewCards,
}: {
  input: DispatchReadinessInput;
  projection: DispatchReadinessProjection;
  missingSignals: string[];
  onReview: () => void;
  reviewing: boolean;
  canWrite: boolean;
  bundle: DispatchReadinessBundle | null;
  writeCtx: () => DispatchReadinessWriteContext;
  onEvidenceRecorded: () => void;
  showPreviewCards: boolean;
}) {
  return (
    <Card className="shadow-none ring-1 ring-border/50">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2">
        <CardTitle className="text-sm font-semibold">Order {input.orderId.slice(-4)}</CardTitle>
        {showPreviewCards ? (
          <div className="flex w-full flex-wrap gap-1">
            <OperationalStatusLabel kind="preview-only" />
            <OperationalStatusLabel kind="demo-data" />
          </div>
        ) : null}
        <div className="flex flex-wrap gap-1">
          <Badge variant={projection.readinessStatus === "gate_eligible" ? "default" : "secondary"}>
            {projection.readinessStatus.replace(/_/g, " ")}
          </Badge>
          <Badge variant="outline">{projection.gateEligibility.replace(/_/g, " ")}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">{projection.safeStaffRecommendation}</p>
        <GovernancePrerequisiteList title="Missing requirements" items={projection.missingRequirements} />
        {missingSignals.length > 0 && (
          <GovernancePrerequisiteList title="Missing live signals" items={missingSignals} variant="destructive" />
        )}
        <div className="flex flex-wrap gap-2 text-xs">
          <span>Reservation: {input.reservationStatus}</span>
          <span>Finance: {financeSignalLabel(input.financeSignal)}</span>
          <span>Gate scan: {input.scan.gateScanVerified ? "verified" : "pending"}</span>
          <span>Carton: {input.scan.cartonBarcodeVerified ? "verified" : "pending"}</span>
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

        <DispatchReadinessEvidencePanel
          orderId={input.orderId}
          bundle={bundle}
          writeCtx={writeCtx}
          dimensionResults={projection.dimensionResults}
          onRecorded={onEvidenceRecorded}
          canWrite={canWrite}
        />

        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={reviewing || !canWrite || projection.readinessStatus === "not_ready"}
          onClick={onReview}
        >
          Record readiness review (evidence)
        </Button>
        {projection.readinessStatus !== "gate_eligible" && projection.readinessStatus !== "ready_for_review" && (
          <p className="text-[10px] text-muted-foreground">
            Review records pending evidence until dimensions pass; verified review unlocks finance gate eligibility.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function DispatchReadinessBoard() {
  const { user, role } = useAuth();
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [bundle, setBundle] = useState<DispatchReadinessBundle | null>(null);
  const [events, setEvents] = useState<OperationalEventRecord[]>([]);

  const boardState = useGovernanceBoardState(
    supabase,
    loadDispatchReadinessRows,
    PREVIEW_ROWS,
    ["orders", "dispatch_readiness_evidence", "operational_scan_records"],
  );

  useEffect(() => {
    let cancelled = false;
    void createDispatchReadinessBundle(supabase)
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
        projection: projectDispatchReadiness(row.input),
      }));
    }
    if (boardState.showPreviewCards) {
      return PREVIEW_READINESS_INPUTS.map((input) => ({
        input,
        missingSignals: [] as string[],
        projection: projectDispatchReadiness(input),
      }));
    }
    return [];
  }, [boardState.liveRows, boardState.showPreviewCards]);

  const writeCtx = (orderId: string): DispatchReadinessWriteContext => ({
    correlationId: `review-${orderId}-${Date.now()}`,
    actorUserId: user?.id ?? "",
    actorRole: role ?? "DISPATCH_MANAGER",
    overrideReason: role === "SUPER_ADMIN" ? "Governed readiness review" : null,
  });

  const governedWritesBlocked = governanceWritesBlocked({
    showPreviewCards: boardState.showPreviewCards,
    persistenceMode: bundle?.persistenceMode,
    canExecuteWrites: bundle?.canExecuteWrites,
  });

  const handleReview = async (input: DispatchReadinessInput) => {
    if (!user?.id || !role || governedWritesBlocked) return;
    setReviewingId(input.orderId);
    try {
      await bundle.service.reviewReadiness(input, writeCtx(input.orderId));
      const evts = await bundle.service.listEvents(input.orderId);
      setEvents(dispatchEventsToOperational(evts));
      boardState.reload();
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
        {bundle && (
          <Badge variant="outline" className="text-[10px]">
            {bundle.persistenceMode}
          </Badge>
        )}
        <Link to="/admin/dispatch-mgmt" className="text-xs text-primary underline-offset-2 hover:underline">
          Dispatch operations
        </Link>
        <Link
          to="/admin/dispatch-completion"
          className="text-xs text-primary underline-offset-2 hover:underline"
        >
          Completion governance (4D)
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
            <strong>gate_eligible</strong> is not dispatched. Record packing photo, document placeholder, and gate
            scan evidence below, then run readiness review. Writes{" "}
            <code className="text-[11px]">dispatch_readiness_evidence</code> only.
          </p>
        </CardContent>
      </Card>

      <section className="grid gap-4 md:grid-cols-2">
        {cardSources.map(({ input, projection, missingSignals }) => (
          <ReadinessCard
            key={input.orderId}
            input={input}
            projection={projection}
            missingSignals={missingSignals}
            reviewing={reviewingId === input.orderId}
            canWrite={!governedWritesBlocked}
            bundle={bundle}
            showPreviewCards={boardState.showPreviewCards}
            writeCtx={() => writeCtx(input.orderId)}
            onEvidenceRecorded={() => boardState.reload()}
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
