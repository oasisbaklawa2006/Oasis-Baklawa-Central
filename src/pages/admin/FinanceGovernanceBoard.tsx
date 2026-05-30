import { useEffect, useMemo, useState } from "react";
import { Landmark, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  FORBIDDEN_FINANCE_ACTIONS,
  projectFinanceRelease,
  type FinanceGovernanceInput,
} from "@/lib/finance-governance";
import { canCommerciallyRelease } from "@/lib/finance-governance/financeApprovalWorkflow";
import { createFinanceGovernanceBundle, type FinanceGovernanceBundle } from "@/lib/finance-governance/createFinanceGovernanceBundle";
import { financeSignalLabel } from "@/lib/dispatch-readiness/financeDispatchSignal";
import { financeEventsToOperational } from "@/lib/finance-governance/financeOperationalBridge";
import { OperationalTimeline } from "@/components/admin/OperationalTimeline";
import { GovernanceBoardLiveNotice } from "@/components/admin/GovernanceBoardLiveNotice";
import { GovernancePrerequisiteList } from "@/components/admin/GovernancePrerequisiteList";
import type { OperationalEventRecord } from "@/lib/operational-events/types";
import { FINANCE_HOLD_LABELS } from "@/lib/finance-governance/financeHoldRules";
import type { FinanceEvidenceRecord } from "@/lib/finance-governance/financeGovernanceTypes";
import {
  loadFinanceGovernanceRows,
  PREVIEW_FINANCE_INPUTS,
  useGovernanceBoardState,
} from "@/lib/execution-read-models";

export const FORBIDDEN_FINANCE_UI_LABELS = [
  "Capture Payment",
  "Generate Invoice",
  "E-Way Bill",
  "Mark Dispatched",
  "Dispatch Complete",
  "Deduct Stock",
] as const;

const PREVIEW_ROWS = PREVIEW_FINANCE_INPUTS.map((input) => ({
  input,
  missingSignals: [] as string[],
}));

function formatEvidenceRow(row: FinanceEvidenceRecord): string {
  return `${row.reviewType} · ${row.reviewStatus} · ref=${row.evidenceRef ?? "—"}`;
}

export default function FinanceGovernanceBoard() {
  const { user, role } = useAuth();
  const [events, setEvents] = useState<OperationalEventRecord[]>([]);
  const [acting, setActing] = useState<string | null>(null);
  const [bundle, setBundle] = useState<FinanceGovernanceBundle | null>(null);
  const [evidenceByOrder, setEvidenceByOrder] = useState<Record<string, FinanceEvidenceRecord[]>>({});

  const boardState = useGovernanceBoardState(
    supabase,
    loadFinanceGovernanceRows,
    PREVIEW_ROWS,
    ["orders", "finance_review_evidence"],
  );

  useEffect(() => {
    let cancelled = false;
    void createFinanceGovernanceBundle(supabase)
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
        projection: projectFinanceRelease(row.input),
      }));
    }
    if (boardState.showPreviewCards) {
      return PREVIEW_FINANCE_INPUTS.map((input) => ({
        input,
        missingSignals: [] as string[],
        projection: projectFinanceRelease(input),
      }));
    }
    return [];
  }, [boardState.liveRows, boardState.showPreviewCards]);

  const reloadEvidence = async (orderIds: string[]) => {
    if (!bundle?.service) return;
    const entries = await Promise.all(
      orderIds.map(async (orderId) => {
        const rows = await bundle.service.listEvidence(orderId);
        return [orderId, rows] as const;
      }),
    );
    setEvidenceByOrder(Object.fromEntries(entries));
  };

  useEffect(() => {
    const ids = cardSources.map((c) => c.input.orderId);
    if (ids.length === 0) return;
    void reloadEvidence(ids);
  }, [bundle?.service, cardSources]);

  const writeCtx = (orderId: string) => ({
    correlationId: `fin-${orderId}-${Date.now()}`,
    actorUserId: user?.id ?? "",
    actorRole: role ?? "FINANCE_HEAD",
    overrideReason: role === "SUPER_ADMIN" ? "CMD finance governance" : null,
    rejectionReason: null,
  });

  const runReview = async (input: FinanceGovernanceInput) => {
    if (!user?.id || !role || !bundle?.canExecuteWrites) return;
    setActing(input.orderId);
    try {
      await bundle.service.startReview(input, writeCtx(input.orderId));
      const evts = await bundle.service.listEvents(input.orderId);
      setEvents(financeEventsToOperational(evts));
      await reloadEvidence([input.orderId]);
      boardState.reload();
    } finally {
      setActing(null);
    }
  };

  const runCommercialRelease = async (input: FinanceGovernanceInput) => {
    if (!user?.id || !role || !bundle?.canExecuteWrites) return;
    setActing(input.orderId);
    try {
      await bundle.service.commercialRelease(input, writeCtx(input.orderId));
      const evts = await bundle.service.listEvents(input.orderId);
      setEvents(financeEventsToOperational(evts));
      await reloadEvidence([input.orderId]);
      boardState.reload();
    } finally {
      setActing(null);
    }
  };

  const hasCommercialRelease = (orderId: string) =>
    (evidenceByOrder[orderId] ?? []).some(
      (r) => r.reviewType === "commercial_release" && r.reviewStatus === "released",
    );

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 pb-24">
      <header className="flex flex-wrap items-center gap-2 border-b border-border pb-4">
        <Landmark className="h-7 w-7 text-primary" aria-hidden />
        <h1 className="text-xl font-bold tracking-tight">Finance governance</h1>
        <Badge variant="outline" className="text-[10px] uppercase">
          Commercial release only
        </Badge>
        {bundle && (
          <Badge variant="outline" className="text-[10px]">
            {bundle.persistenceMode}
          </Badge>
        )}
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
          <ShieldAlert className="h-5 w-5 shrink-0 text-amber-600" aria-hidden />
          <div className="space-y-1">
            <p>
              <strong>Step 1 — Start finance review</strong> appends <code className="text-[11px]">finance_review_evidence</code>{" "}
              (<code className="text-[11px]">credit_review</code> / pending).{" "}
              <strong>Step 2 — Record commercial release</strong> appends commercial_release / released when projection is{" "}
              <code className="text-[11px]">commercially_released</code>. Neither step dispatches or captures payment.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {cardSources.map(({ input, projection, missingSignals }) => {
          const releaseEligible = canCommerciallyRelease(input);
          const persisted = evidenceByOrder[input.orderId] ?? [];
          const alreadyReleased = hasCommercialRelease(input.orderId);

          return (
            <Card key={input.orderId} className="ring-1 ring-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Order {input.orderId.slice(-4)}</CardTitle>
                <div className="flex flex-wrap gap-1">
                  <Badge>{projection.releaseStatus.replace(/_/g, " ")}</Badge>
                  <Badge variant="outline">Risk: {projection.commercialRiskLevel}</Badge>
                  <Badge variant="secondary">
                    Dispatch signal: {financeSignalLabel(projection.dispatchFinanceSignal)}
                  </Badge>
                  <Badge variant={input.dispatchReadinessGateEligible ? "default" : "destructive"}>
                    Gate eligible: {input.dispatchReadinessGateEligible ? "yes" : "no"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="text-muted-foreground">{projection.releaseRecommendation}</p>
                <GovernancePrerequisiteList
                  title="Release blockers"
                  items={projection.blockingReasons}
                  variant={projection.blockingReasons.length > 0 ? "destructive" : "default"}
                />
                {missingSignals.length > 0 && (
                  <GovernancePrerequisiteList title="Missing signals" items={missingSignals} variant="destructive" />
                )}
                {input.openHoldTypes.map((h) => (
                  <Badge key={h} variant="destructive" className="text-[10px]">
                    {FINANCE_HOLD_LABELS[h]}
                  </Badge>
                ))}

                {persisted.length > 0 && (
                  <div className="rounded-md border border-border/50 bg-muted/20 p-2 text-[11px]">
                    <p className="font-medium">Persisted finance_review_evidence</p>
                    <ul className="mt-1 list-inside list-disc font-mono text-muted-foreground">
                      {persisted.map((row) => (
                        <li key={row.id}>{formatEvidenceRow(row)}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="space-y-2 border-t border-border/50 pt-2">
                  <p className="text-xs font-medium">Governed actions</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full justify-start"
                    disabled={!!acting || !bundle?.canExecuteWrites}
                    onClick={() => void runReview(input)}
                  >
                    Step 1 — Start finance review (writes credit_review evidence)
                  </Button>
                  <Button
                    size="sm"
                    className="w-full justify-start"
                    disabled={
                      !!acting ||
                      !bundle?.canExecuteWrites ||
                      alreadyReleased ||
                      !releaseEligible
                    }
                    onClick={() => void runCommercialRelease(input)}
                  >
                    Step 2 — Record commercial release
                  </Button>
                  {!releaseEligible && !alreadyReleased && (
                    <p className="text-[10px] text-destructive">
                      Commercial release disabled: projection must be commercially_released (requires dispatch gate
                      eligible + reservation + cleared finance holds). Current: {projection.releaseStatus}.
                    </p>
                  )}
                  {alreadyReleased && (
                    <p className="text-[10px] text-muted-foreground">
                      Commercial release evidence already on file for this order.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Evidence timeline (internal)</CardTitle>
        </CardHeader>
        <CardContent>
          <OperationalTimeline
            events={events}
            showFilters={false}
            defaultFilter="financial"
            ariaLabel="Finance governance timeline"
          />
        </CardContent>
      </Card>

      <p className="text-[10px] text-muted-foreground">
        Forbidden: {FORBIDDEN_FINANCE_ACTIONS.join(", ")} · UI: no {FORBIDDEN_FINANCE_UI_LABELS.join(", ")}
      </p>
    </div>
  );
}
