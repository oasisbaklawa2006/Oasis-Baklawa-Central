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
  const packetMessages = useMemo(() => {
    if (!selectedPacket) return [];
    // Legacy/test rows may omit packet_id because they are already nested under
    // the selected packet. When packet_id is present it is authoritative: never
    // permit a neighbouring packet's fragment into this decoder context.
    return (selectedPacket.messages ?? []).filter(
      (message) => message.packet_id == null || message.packet_id === selectedPacket.id,
    );
  }, [selectedPacket?.id, selectedPacket?.messages]);

  const hasCrossPacketMessages = useMemo(() => {
    if (!selectedPacket) return false;
    return (selectedPacket.messages ?? []).some(
      (message) => message.packet_id != null && message.packet_id !== selectedPacket.id,
    );
  }, [selectedPacket?.id, selectedPacket?.messages]);

  const stitchedPlainText = useMemo(() => {
    if (!selectedPacket) return "";
    // If the loaded nested rows prove cross-packet contamination, do not fall
    // back to stitched text: fail closed instead of risking mixed-order input.
    if (hasCrossPacketMessages) return "";
    return packetStitchedPlainText(selectedPacket.stitched_content);
  }, [selectedPacket?.stitched_content, hasCrossPacketMessages]);

  const sourceText = useMemo(() => {
    if (hasCrossPacketMessages) return "";
    const inbound = packetMessages
      .filter((m) => m.direction === "inbound")
      .slice()
      .sort((a, b) => {
        const aSequence = a.packet_sequence;
        const bSequence = b.packet_sequence;
        if (typeof aSequence === "number" && typeof bSequence === "number" && aSequence !== bSequence) {
          return aSequence - bSequence;
        }
        const aTime = new Date(a.created_at).getTime();
        const bTime = new Date(b.created_at).getTime();
        if (Number.isFinite(aTime) && Number.isFinite(bTime) && aTime !== bTime) return aTime - bTime;
        return a.id.localeCompare(b.id);
      })
      .map((m) => m.content ?? "")
      .join("\n");
    return (inbound || stitchedPlainText).slice(0, 12000);
  }, [packetMessages, stitchedPlainText, hasCrossPacketMessages]);

  const requestKey = useMemo(() => {
    if (!selectedPacket || hasCrossPacketMessages) return null;
    return buildDraftOrderExtractionRequestKey({
      packetId: selectedPacket.id,
      contentFingerprint: buildPacketContentFingerprint(packetMessages, stitchedPlainText),
      clientResolutionState,
      productResolutionState,
      quantityResolutionState,
      senderIdentityKey: buildSenderIdentityKey(senderIdentityState),
    });
  }, [
    selectedPacket?.id,
    packetMessages,
    stitchedPlainText,
    hasCrossPacketMessages,
    clientResolutionState,
    productResolutionState,
    quantityResolutionState,
    senderIdentityState,
  ]);

  const state = useMemo((): OperatorInboxDraftOrderExtractionState => {
    if (!selectedPacket || hasCrossPacketMessages) return { status: "idle" };
    if (!requestKey) return { status: "idle" };

    if (isDraftOrderExtractionUpstreamLoading({ clientResolutionState, productResolutionState, quantityResolutionState })) {
      return { status: "loading", requestKey, draft: buildPendingDraftOrder({ packetId: selectedPacket.id, extractionRequestKey: requestKey, sourceText, status: "upstream_loading" }) };
    }

    const upstreamError = firstUpstreamErrorMessage({ clientResolutionState, productResolutionState, quantityResolutionState });
    if (upstreamError) {
      return { status: "error", requestKey, message: upstreamError, draft: buildPendingDraftOrder({ packetId: selectedPacket.id, extractionRequestKey: requestKey, sourceText, status: "upstream_error", upstreamErrorMessage: upstreamError }) };
    }

    if (!isDraftOrderExtractionUpstreamReady({ clientResolutionState, productResolutionState, quantityResolutionState })) return { status: "idle" };

    const draft = extractDraftOrderFromResolution({
      packetId: selectedPacket.id,
      extractionRequestKey: requestKey,
      sourceText,
      client: clientResolutionState.status === "ready" ? clientResolutionState.result : null,
      product: productResolutionState.status === "ready" ? productResolutionState.result : null,
      quantity: quantityResolutionState.status === "ready" ? quantityResolutionState.result : null,
      senderIdentity: senderIdentityState.status === "ready" ? senderIdentityState.identity : null,
    });

    return { status: "ready", requestKey, draft };
  }, [selectedPacket, hasCrossPacketMessages, requestKey, sourceText, clientResolutionState, productResolutionState, quantityResolutionState, senderIdentityState]);

  return { state, requestKey };
}
