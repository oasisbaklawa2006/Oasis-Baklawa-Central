import { useCallback, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getDraftOrderLocalEdits } from "@/components/whatsapp/operatorInboxDraftOrderLocalState";
import type { ExtractedDraftOrder } from "@/lib/wa-governance/draftOrderExtractionTypes";
import { buildSalesOrderDraftComparisonView } from "@/lib/wa-sales-order-draft/buildComparisonView";
import {
  approveSalesOrderDraft,
  createSalesOrderDraft,
  fetchSalesOrderDraftByPacket,
  rejectSalesOrderDraft,
  submitSalesOrderDraftForReview,
  updateSalesOrderDraftOperatorFinal,
} from "@/lib/wa-sales-order-draft/salesOrderDraftRepository";
import { resolveOperatorLineQuantities } from "@/lib/wa-sales-order-draft/resolveOperatorLineQuantities";
import { isTerminalStatus, statusLabel } from "@/lib/wa-sales-order-draft/workflowTransitions";
import type { SalesOrderDraftBundle } from "@/lib/wa-sales-order-draft/types";
import { canTransitionToApproved } from "@/lib/wa-sales-order-draft/readinessValidation";

export type SalesOrderDraftUiState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; bundle: SalesOrderDraftBundle | null }
  | { status: "error"; message: string };

function actorFromUser(user: User | null): { id: string; name: string } | null {
  if (!user?.id) return null;
  const meta = user.user_metadata as Record<string, unknown> | undefined;
  const name =
    (typeof meta?.full_name === "string" && meta.full_name) ||
    (typeof meta?.name === "string" && meta.name) ||
    user.email ||
    user.id;
  return { id: user.id, name };
}

export function useOperatorInboxSalesOrderDraft(args: {
  packetId: string | null;
  extracted: ExtractedDraftOrder | null;
  operatorLineQuantities: Record<number, number>;
  user: User | null;
  enabled: boolean;
}) {
  const { packetId, extracted, operatorLineQuantities, user, enabled } = args;
  const [state, setState] = useState<SalesOrderDraftUiState>({ status: "idle" });
  const [actionPending, setActionPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!packetId || !enabled) {
      setState({ status: "idle" });
      return;
    }
    setState({ status: "loading" });
    try {
      const bundle = await fetchSalesOrderDraftByPacket(packetId);
      setState({ status: "ready", bundle });
    } catch (error) {
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "Failed to load sales order draft.",
      });
    }
  }, [packetId, enabled]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const comparisonView = useMemo(() => {
    if (state.status !== "ready" || !state.bundle) return null;
    return buildSalesOrderDraftComparisonView(state.bundle);
  }, [state]);

  const approvalReadiness = useMemo(() => {
    if (state.status !== "ready" || !state.bundle) return null;
    return canTransitionToApproved(state.bundle.draft.readiness_dimensions);
  }, [state]);

  const runAction = useCallback(
    async (fn: () => Promise<SalesOrderDraftBundle>) => {
      setActionPending(true);
      setActionError(null);
      try {
        const bundle = await fn();
        setState({ status: "ready", bundle });
      } catch (error) {
        setActionError(error instanceof Error ? error.message : "Action failed.");
      } finally {
        setActionPending(false);
      }
    },
    [],
  );

  const resolveLatestOperatorLineQuantities = useCallback(() => {
    const stored = packetId ? getDraftOrderLocalEdits(packetId).lineQuantities : {};
    return resolveOperatorLineQuantities({
      parentLineQuantities: operatorLineQuantities,
      storedLineQuantities: stored,
    });
  }, [operatorLineQuantities, packetId]);

  const createDraft = useCallback(async () => {
    const actor = actorFromUser(user);
    if (!extracted || !actor) {
      setActionError("Sign in and wait for draft extraction before creating a Sales Order Draft.");
      return;
    }
    const latestQuantities = resolveLatestOperatorLineQuantities();
    await runAction(() =>
      createSalesOrderDraft({
        extracted,
        operatorLineQuantities: latestQuantities,
        actor,
      }),
    );
  }, [extracted, resolveLatestOperatorLineQuantities, runAction, user]);

  const submitForReview = useCallback(async () => {
    const actor = actorFromUser(user);
    if (state.status !== "ready" || !state.bundle || !actor) return;
    const draftId = state.bundle.draft.id;
    const latestQuantities = resolveLatestOperatorLineQuantities();
    await runAction(async () => {
      if (extracted) {
        await updateSalesOrderDraftOperatorFinal({
          draftId,
          extracted,
          operatorLineQuantities: latestQuantities,
          actor,
        });
      }
      return submitSalesOrderDraftForReview({ draftId, actor });
    });
  }, [extracted, resolveLatestOperatorLineQuantities, runAction, state, user]);

  const approveDraft = useCallback(async (reviewNotes?: string) => {
    const actor = actorFromUser(user);
    if (state.status !== "ready" || !state.bundle || !actor) return;
    const draftId = state.bundle.draft.id;
    const latestQuantities = resolveLatestOperatorLineQuantities();
    await runAction(async () => {
      if (extracted) {
        await updateSalesOrderDraftOperatorFinal({
          draftId,
          extracted,
          operatorLineQuantities: latestQuantities,
          actor,
        });
      }
      return approveSalesOrderDraft({
        draftId,
        actor,
        reviewNotes,
      });
    });
  }, [extracted, resolveLatestOperatorLineQuantities, runAction, state, user]);

  const rejectDraft = useCallback(
    async (rejectionReason: string, reviewNotes?: string) => {
      const actor = actorFromUser(user);
      if (state.status !== "ready" || !state.bundle || !actor) return;
      await runAction(() =>
        rejectSalesOrderDraft({
          draftId: state.bundle!.draft.id,
          actor,
          rejectionReason,
          reviewNotes,
        }),
      );
    },
    [runAction, state, user],
  );

  const syncOperatorFinal = useCallback(async () => {
    const actor = actorFromUser(user);
    if (state.status !== "ready" || !state.bundle || !extracted || !actor) return;
    const latestQuantities = resolveLatestOperatorLineQuantities();
    await runAction(() =>
      updateSalesOrderDraftOperatorFinal({
        draftId: state.bundle!.draft.id,
        extracted,
        operatorLineQuantities: latestQuantities,
        actor,
      }),
    );
  }, [extracted, resolveLatestOperatorLineQuantities, runAction, state, user]);

  const draftStatus =
    state.status === "ready" && state.bundle ? state.bundle.draft.status : null;
  const isTerminal = draftStatus ? isTerminalStatus(draftStatus) : false;

  return {
    state,
    comparisonView,
    approvalReadiness,
    actionPending,
    actionError,
    draftStatus,
    statusLabel: draftStatus ? statusLabel(draftStatus) : null,
    isTerminal,
    reload,
    createDraft,
    submitForReview,
    approveDraft,
    rejectDraft,
    syncOperatorFinal,
  };
}
