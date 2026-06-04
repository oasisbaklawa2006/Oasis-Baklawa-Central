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
  const requestGenerationRef = useRef(0);
  const actionTokenRef = useRef(0);

  useEffect(() => {
    activePacketIdRef.current = packetId;
    requestGenerationRef.current += 1;
    actionTokenRef.current += 1;
    setActionPending(false);
    if (packetId && enabled) {
      setState({ status: "loading" });
    } else {
      setState({ status: "idle" });
    }
  }, [packetId, enabled]);

  const isActivePacketRequest = useCallback((requestPacketId: string, requestGeneration: number) => {
    return (
      activePacketIdRef.current === requestPacketId &&
      requestGenerationRef.current === requestGeneration
    );
  }, []);

  const reload = useCallback(async () => {
    if (!packetId || !enabled) {
      setState({ status: "idle" });
      return;
    }
    const requestPacketId = packetId;
    const requestGeneration = requestGenerationRef.current;
    setState({ status: "loading" });
    try {
      const bundle = await fetchSalesOrderDraftByPacket(requestPacketId);
      if (!isActivePacketRequest(requestPacketId, requestGeneration)) return;
      if (bundle && bundle.draft.packet_id !== requestPacketId) return;
      setState({ status: "ready", bundle });
    } catch (error) {
      if (!isActivePacketRequest(requestPacketId, requestGeneration)) return;
      setState((prev) => ({
        status: "error",
        message: error instanceof Error ? error.message : "Failed to load sales order draft.",
        bundle: prev.status === "ready" ? prev.bundle : null,
      }));
    }
  }, [packetId, enabled, isActivePacketRequest]);

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
      const requestGeneration = requestGenerationRef.current;
      const actionToken = ++actionTokenRef.current;
      setActionPending(true);
      setActionError(null);
      try {
        const bundle = await fn();
        if (!isActivePacketRequest(requestPacketId, requestGeneration)) return;
        if (bundle.draft.packet_id !== requestPacketId) return;
        setState({ status: "ready", bundle });
      } catch (error) {
        if (!isActivePacketRequest(requestPacketId, requestGeneration)) return;
        setActionError(error instanceof Error ? error.message : "Action failed.");
      } finally {
        if (actionTokenRef.current === actionToken) {
          setActionPending(false);
        }
      }
    },
    [isActivePacketRequest, packetId],
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
    if (extractionProjectionStale) {
      setActionError("This draft was created from an older WhatsApp extraction. Reject it before submitting with the latest extraction.");
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
  }, [currentBundle, extracted, extractionProjectionStale, resolveLatestOperatorLineQuantities, runAction, user]);

  const approveDraft = useCallback(async (reviewNotes?: string) => {
    const actor = actorFromUser(user);
    if (!currentBundle || !actor) return;
    if (!extracted) {
      setActionError("Waiting for latest WhatsApp extraction.");
      return;
    }
    if (extractionProjectionStale) {
      setActionError(
        "Cannot approve: draft was created from an older WhatsApp extraction. Reject and create a new draft first.",
      );
      return;
    }
    await runAction(() =>
      approveSalesOrderDraft({
        draftId: currentBundle.draft.id,
        actor,
        reviewNotes,
      }),
    );
  }, [currentBundle, extracted, extractionProjectionStale, runAction, user]);

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
    if (extractionProjectionStale) {
      setActionError("This draft was created from an older WhatsApp extraction. Reject it before syncing with the latest extraction.");
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
  }, [currentBundle, extracted, extractionProjectionStale, resolveLatestOperatorLineQuantities, runAction, user]);

  const draftStatus = currentBundle ? currentBundle.draft.status : null;
  const isTerminal = draftStatus ? isTerminalStatus(draftStatus) : false;
  const isPersistedDraftLoading =
    Boolean(enabled && packetId) && (state.status === "loading" || state.status === "idle");
  const canShowCreateDraft = state.status === "ready" && !currentBundle;
  const approveExtractionReady = Boolean(extracted);
  const canApproveDraft =
    approveExtractionReady &&
    !extractionProjectionStale &&
    Boolean(approvalReadiness?.valid);

  return {
    state,
    comparisonView,
    approvalReadiness,
    extractionProjectionStale,
    approveExtractionReady,
    canApproveDraft,
    actionPending,
    actionError,
    draftStatus,
    statusLabel: draftStatus ? statusLabel(draftStatus) : null,
    isTerminal,
    isPersistedDraftLoading,
    canShowCreateDraft,
    reload,
    createDraft,
    submitForReview,
    approveDraft,
    rejectDraft,
    syncOperatorFinal,
  };
}
