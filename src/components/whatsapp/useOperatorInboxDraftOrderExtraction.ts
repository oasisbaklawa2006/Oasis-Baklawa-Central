import { useMemo } from "react";
import {
  buildPendingDraftOrder,
  extractDraftOrderFromResolution,
} from "@/lib/wa-governance/draftOrderExtraction";
import {
  buildDraftOrderExtractionRequestKey,
  firstUpstreamErrorMessage,
  isDraftOrderExtractionUpstreamLoading,
  isDraftOrderExtractionUpstreamReady,
} from "@/lib/wa-governance/draftOrderExtractionRequestKey";
import type { ExtractedDraftOrder } from "@/lib/wa-governance/draftOrderExtractionTypes";
import { buildPacketContentFingerprint } from "@/lib/wa-governance/clientResolutionRequestKey";
import type { OperatorInboxClientResolutionState } from "./useOperatorInboxClientResolution";
import type { OperatorInboxPacket } from "./operatorInboxTypes";
import { packetStitchedPlainText } from "./operatorInboxUtils";
import type { OperatorInboxProductResolutionState } from "./useOperatorInboxProductResolution";
import type { OperatorInboxQuantityResolutionState } from "./useOperatorInboxQuantityResolution";
import type { OperatorInboxSenderIdentityState } from "./useOperatorInboxSenderIdentity";

export type OperatorInboxDraftOrderExtractionState =
  | { status: "idle" }
  | { status: "loading"; requestKey: string; draft: ExtractedDraftOrder }
  | { status: "ready"; requestKey: string; draft: ExtractedDraftOrder }
  | { status: "error"; requestKey: string; draft: ExtractedDraftOrder; message: string };

function buildSenderIdentityKey(senderIdentityState: OperatorInboxSenderIdentityState): string {
  if (senderIdentityState.status === "ready") {
    const id = senderIdentityState.identity.employeeProfile?.id ?? senderIdentityState.identity.contactId;
    return `sender:${senderIdentityState.identity.kind}:${id ?? "none"}`;
  }
  return `sender:${senderIdentityState.status}`;
}

export function useOperatorInboxDraftOrderExtraction(
  selectedPacket: OperatorInboxPacket | null,
  senderIdentityState: OperatorInboxSenderIdentityState,
  clientResolutionState: OperatorInboxClientResolutionState,
  productResolutionState: OperatorInboxProductResolutionState,
  quantityResolutionState: OperatorInboxQuantityResolutionState,
): { state: OperatorInboxDraftOrderExtractionState; requestKey: string | null } {
  const stitchedPlainText = useMemo(() => {
    if (!selectedPacket) return "";
    return packetStitchedPlainText(selectedPacket.stitched_content);
  }, [selectedPacket?.stitched_content]);

  const sourceText = useMemo(() => {
    const inbound = (selectedPacket?.messages ?? [])
      .filter((m) => m.direction === "inbound")
      .map((m) => m.content ?? "")
      .join("\n");
    return (inbound || stitchedPlainText).slice(0, 12000);
  }, [selectedPacket?.messages, stitchedPlainText]);

  const requestKey = useMemo(() => {
    if (!selectedPacket) return null;
    return buildDraftOrderExtractionRequestKey({
      packetId: selectedPacket.id,
      contentFingerprint: buildPacketContentFingerprint(selectedPacket.messages, stitchedPlainText),
      clientResolutionState,
      productResolutionState,
      quantityResolutionState,
      senderIdentityKey: buildSenderIdentityKey(senderIdentityState),
    });
  }, [
    selectedPacket?.id,
    selectedPacket?.messages,
    stitchedPlainText,
    clientResolutionState,
    productResolutionState,
    quantityResolutionState,
    senderIdentityState,
  ]);

  const state = useMemo((): OperatorInboxDraftOrderExtractionState => {
    if (!selectedPacket || !requestKey) return { status: "idle" };

    if (isDraftOrderExtractionUpstreamLoading({
      clientResolutionState,
      productResolutionState,
      quantityResolutionState,
    })) {
      return {
        status: "loading",
        requestKey,
        draft: buildPendingDraftOrder({
          packetId: selectedPacket.id,
          extractionRequestKey: requestKey,
          sourceText,
          status: "upstream_loading",
        }),
      };
    }

    const upstreamError = firstUpstreamErrorMessage({
      clientResolutionState,
      productResolutionState,
      quantityResolutionState,
    });
    if (upstreamError) {
      return {
        status: "error",
        requestKey,
        message: upstreamError,
        draft: buildPendingDraftOrder({
          packetId: selectedPacket.id,
          extractionRequestKey: requestKey,
          sourceText,
          status: "upstream_error",
          upstreamErrorMessage: upstreamError,
        }),
      };
    }

    if (!isDraftOrderExtractionUpstreamReady({
      clientResolutionState,
      productResolutionState,
      quantityResolutionState,
    })) {
      return { status: "idle" };
    }

    const draft = extractDraftOrderFromResolution({
      packetId: selectedPacket.id,
      extractionRequestKey: requestKey,
      sourceText,
      client:
        clientResolutionState.status === "ready" ? clientResolutionState.result : null,
      product:
        productResolutionState.status === "ready" ? productResolutionState.result : null,
      quantity:
        quantityResolutionState.status === "ready" ? quantityResolutionState.result : null,
      senderIdentity:
        senderIdentityState.status === "ready" ? senderIdentityState.identity : null,
    });

    return { status: "ready", requestKey, draft };
  }, [
    selectedPacket,
    requestKey,
    sourceText,
    clientResolutionState,
    productResolutionState,
    quantityResolutionState,
    senderIdentityState,
  ]);

  return { state, requestKey };
}
