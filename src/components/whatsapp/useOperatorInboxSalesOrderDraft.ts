import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getDraftOrderLocalEdits, clearDraftOrderLocalEdits } from "@/components/whatsapp/operatorInboxDraftOrderLocalState";
import type { ExtractedDraftOrder } from "@/lib/wa-governance/draftOrderExtractionTypes";
import { buildSalesOrderDraftComparisonView } from "@/lib/wa-sales-order-draft/buildComparisonView";
import {
  approveSalesOrderDraft,
  createSalesOrderDraft,
  fetchSalesOrderDraftByPacket,
  rejectSalesOrderDraft,
  submitSalesOrderDraftForReviewWithOperatorSync,
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
  | { status: "error"; message: string; bundle?: SalesOrderDraftBundle | null };

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
  const activePacketIdRef = useRef<string | null>(packetId);

  useEffect(() => {
    activePacketIdRef.current = packetId;
  }, [packetId]);

  const isActivePacket = useCallback((requestPacketId: string) => {
    return activePacketIdRef.current === requestPacketId;
  }, []);

  const reload = useCallback(async () => {
    if (!packetId || !enabled) {
      setState({ status: "idle" });
      return;
    }
    const requestPacketId = packetId;
    setState({ status: "loading" });
    try {
      const bundle = await fetchSalesOrderDraftByPacket(requestPacketId);
      if (!isActivePacket(requestPacketId)) return;
      setState({ status: "ready", bundle });
    } catch (error) {
      if (!isActivePacket(requestPacketId)) return;
      setState((prev) => ({
        status: "error",
        message: error instanceof Error ? error.message : "Failed to load sales order draft.",
        bundle: prev.status === "ready" ? prev.bundle : null,
      }));
    }
  }, [packetId, enabled, isActivePacket]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const currentBundle = useMemo(() => {
    if (state.status === "ready") return state.bundle;
    if (state.status === "error") return state.bundle ?? null;
    return null;
  }, [state]);

  const comparisonView = useMemo(() => {
    if (!currentBundle) return null;
    return buildSalesOrderDraftComparisonView(currentBundle);
  }, [currentBundle]);

  const approvalReadiness = useMemo(() => {
    if (!currentBundle) return null;
    return canTransitionToApproved(currentBundle.draft.readiness_dimensions);
  }, [currentBundle]);

  const extractionProjectionStale = useMemo(
    () =>
      Boolean(
        extracted &&
          currentBundle &&
          extracted.extractionRequestKey !== currentBundle.draft.extraction_request_key,
      ),
    [currentBundle, extracted],
  );

  const runAction = useCallback(
    async (fn: () => Promise<SalesOrderDraftBundle>) => {
      if (!packetId) return;
      const requestPacketId = packetId;
      setActionPending(true);
      setActionError(null);
      try {
        const bundle = await fn();
        if (!isActivePacket(requestPacketId)) return;
        setState({ status: "ready", bundle });
      } catch (error) {
        if (!isActivePacket(requestPacketId)) return;
        setActionError(error instanceof Error ? error.message : "Action failed.");
      } finally {
        setActionPending(false);
      }
    },
    [isActivePacket, packetId],
  );

  const resolveLatestOperatorLineQuantities = useCallback(() => {
    const stored = packetId ? getDraftOrderLocalEdits(packetId).lineQuantities : {};
    return resolveOperatorLineQuantities({
      parentLineQuantities: operatorLineQuantities,
      storedLineQuantities: stored,
    });
  }, [operatorLineQuantities, packetId]);

  const resolveCreateOperatorLineQuantities = useCallback(() => {
    if (extractionProjectionStale) {
      return resolveOperatorLineQuantities({
        parentLineQuantities: operatorLineQuantities,
        storedLineQuantities: {},
      });
    }
    return resolveLatestOperatorLineQuantities();
  }, [extractionProjectionStale, operatorLineQuantities, resolveLatestOperatorLineQuantities]);

  const createDraft = useCallback(async () => {
    const actor = actorFromUser(user);
    if (!extracted || !actor) {
      setActionError("Sign in and wait for draft extraction before creating a Sales Order Draft.");
      return;
    }
    const latestQuantities = resolveCreateOperatorLineQuantities();
    await runAction(() =>
      createSalesOrderDraft({
        extracted,
        operatorLineQuantities: latestQuantities,
        actor,
      }),
    );
  }, [extracted, resolveCreateOperatorLineQuantities, runAction, user]);

  const submitForReview = useCallback(async () => {
    const actor = actorFromUser(user);
    if (!currentBundle || !actor) return;
    if (!extracted) {
      setActionError("Draft extraction must be ready before submitting for review.");
      return;
    }
    const latestQuantities = resolveLatestOperatorLineQuantities();
    await runAction(() =>
      submitSalesOrderDraftForReviewWithOperatorSync({
        draftId: currentBundle.draft.id,
        extracted,
        operatorLineQuantities: latestQuantities,
        actor,
      }),
    );
  }, [currentBundle, extracted, resolveLatestOperatorLineQuantities, runAction, user]);

  const approveDraft = useCallback(async (reviewNotes?: string) => {
    const actor = actorFromUser(user);
    if (!currentBundle || !actor) return;
    await runAction(() =>
      approveSalesOrderDraft({
        draftId: currentBundle.draft.id,
        actor,
        reviewNotes,
      }),
    );
  }, [currentBundle, runAction, user]);

  const rejectDraft = useCallback(
    async (rejectionReason: string, reviewNotes?: string) => {
      const actor = actorFromUser(user);
      if (!currentBundle || !actor) return;
      const shouldClearLocalEdits = extractionProjectionStale;
      await runAction(async () => {
        const bundle = await rejectSalesOrderDraft({
          draftId: currentBundle.draft.id,
          actor,
          rejectionReason,
          reviewNotes,
        });
        if (packetId && shouldClearLocalEdits) {
          clearDraftOrderLocalEdits(packetId);
        }
        return bundle;
      });
    },
    [runAction, currentBundle, extractionProjectionStale, packetId, user],
  );

  const syncOperatorFinal = useCallback(async () => {
    const actor = actorFromUser(user);
    if (!currentBundle || !actor) return;
    if (!extracted) {
      setActionError("Draft extraction must be ready before syncing operator edits.");
      return;
    }
    const latestQuantities = resolveLatestOperatorLineQuantities();
    await runAction(() =>
      updateSalesOrderDraftOperatorFinal({
        draftId: currentBundle.draft.id,
        extracted,
        operatorLineQuantities: latestQuantities,
        actor,
      }),
    );
  }, [currentBundle, extracted, resolveLatestOperatorLineQuantities, runAction, user]);

  const draftStatus = currentBundle ? currentBundle.draft.status : null;
  const isTerminal = draftStatus ? isTerminalStatus(draftStatus) : false;

  return {
    state,
    comparisonView,
    approvalReadiness,
    extractionProjectionStale,
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
