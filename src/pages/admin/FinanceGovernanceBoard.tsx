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
import { createFinanceGovernanceBundle, type FinanceGovernanceBundle } from "@/lib/finance-governance/createFinanceGovernanceBundle";
import { financeSignalLabel } from "@/lib/dispatch-readiness/financeDispatchSignal";
import { financeEventsToOperational } from "@/lib/finance-governance/financeOperationalBridge";
import { OperationalTimeline } from "@/components/admin/OperationalTimeline";
import { GovernanceBoardLiveNotice } from "@/components/admin/GovernanceBoardLiveNotice";
import type { OperationalEventRecord } from "@/lib/operational-events/types";
import { FINANCE_HOLD_LABELS } from "@/lib/finance-governance/financeHoldRules";
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

export default function FinanceGovernanceBoard() {
  const { user, role } = useAuth();
  const [events, setEvents] = useState<OperationalEventRecord[]>([]);
  const [acting, setActing] = useState<string | null>(null);
  const [bundle, setBundle] = useState<FinanceGovernanceBundle | null>(null);

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
        projection: projectFinanceRelease(row.input),
      }));
    }
    if (boardState.showPreviewCards) {
      return PREVIEW_FINANCE_INPUTS.map((input) => ({
        input,
        projection: projectFinanceRelease(input),
      }));
    }
    return [];
  }, [boardState.liveRows, boardState.showPreviewCards]);

  const runReview = async (input: FinanceGovernanceInput) => {
    if (!user?.id || !role || !bundle?.canExecuteWrites) return;
    setActing(input.orderId);
    try {
      await bundle.service.startReview(input, {
        correlationId: `fin-${Date.now()}`,
        actorUserId: user.id,
        actorRole: role,
        overrideReason: role === "SUPER_ADMIN" ? "CMD finance review" : null,
      });
      const evts = await bundle.service.listEvents(input.orderId);
      setEvents(financeEventsToOperational(evts));
    } finally {
      setActing(null);
    }
  };

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
          <p>
            <strong>commercially_released</strong> allows operational progression signals only — not invoiced,
            not payment captured, not dispatched.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {cardSources.map(({ input, projection }) => (
          <Card key={input.orderId} className="ring-1 ring-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Order {input.orderId.slice(-4)}</CardTitle>
              <div className="flex flex-wrap gap-1">
                <Badge>{projection.releaseStatus.replace(/_/g, " ")}</Badge>
                <Badge variant="outline">Risk: {projection.commercialRiskLevel}</Badge>
                <Badge variant="secondary">
                  Dispatch signal: {financeSignalLabel(projection.dispatchFinanceSignal)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-muted-foreground">{projection.releaseRecommendation}</p>
              {projection.blockingReasons.length > 0 && (
                <ul className="list-inside list-disc text-xs">
                  {projection.blockingReasons.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              )}
              {input.openHoldTypes.map((h) => (
                <Badge key={h} variant="destructive" className="text-[10px]">
                  {FINANCE_HOLD_LABELS[h]}
                </Badge>
              ))}
              <Button
                size="sm"
                variant="secondary"
                disabled={!!acting || !bundle?.canExecuteWrites}
                onClick={() => void runReview(input)}
              >
                Start finance review
              </Button>
            </CardContent>
          </Card>
        ))}
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
