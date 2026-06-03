import {
  buildPacketContentFingerprint,
  buildPacketMessagesFingerprint,
  serializeClientResolutionIdentity,
  type ClientResolutionPacketMessage,
  type ClientResolutionPacketSnapshot,
  type ClientResolutionSenderIdentitySnapshot,
  type OperatorInboxClientResolutionState,
} from "./clientResolutionRequestKey";
import { pickLatestInboundSnippetForIdentifySender } from "./senderIdentitySnippet";
import type { OperatorInboxProductResolutionState } from "./productResolutionRequestKey";
import { serializeClientResolutionBestMatch } from "./productResolutionRequestKey";
import type { QuantityResolutionInput, QuantityResolutionResult } from "./quantityResolutionTypes";

export type QuantityResolutionPacketSnapshot = ClientResolutionPacketSnapshot;
export type QuantityResolutionPacketMessage = ClientResolutionPacketMessage;
export type QuantityResolutionSenderIdentitySnapshot = ClientResolutionSenderIdentitySnapshot;

export interface QuantityResolutionRequestDescriptor {
  packetId: string;
  contentFingerprint: string;
  clientResolutionBestMatch: string;
  productResolutionBestMatch: string;
  identity: QuantityResolutionSenderIdentitySnapshot;
}

export type OperatorInboxQuantityResolutionState =
  | { status: "idle" }
  | { status: "loading"; requestKey: string }
  | { status: "ready"; requestKey: string; result: QuantityResolutionResult }
  | { status: "error"; requestKey: string; message: string };

export function serializeProductResolutionBestMatch(
  productResolutionState: OperatorInboxProductResolutionState,
): string {
  if (
    productResolutionState.status === "loading" ||
    productResolutionState.status === "idle"
  ) {
    return "product:pending";
  }
  if (productResolutionState.status === "error") return "product:error";
  const best = productResolutionState.result.bestMatch;
  if (!best) return "product:none";
  return `product:${best.productId}:${best.productName}`;
}

export function buildQuantityResolutionRequestKey(
  descriptor: QuantityResolutionRequestDescriptor,
): string {
  return [
    descriptor.packetId,
    descriptor.contentFingerprint,
    descriptor.clientResolutionBestMatch,
    descriptor.productResolutionBestMatch,
    serializeClientResolutionIdentity(descriptor.identity),
  ].join("|");
}

export function buildQuantityResolutionRequestDescriptor(
  packet: QuantityResolutionPacketSnapshot | null,
  identity: QuantityResolutionSenderIdentitySnapshot,
  stitchedPlainText: string,
  clientResolutionState: OperatorInboxClientResolutionState,
  productResolutionState: OperatorInboxProductResolutionState,
): QuantityResolutionRequestDescriptor | null {
  if (!packet) return null;
  return {
    packetId: packet.id,
    contentFingerprint: buildPacketContentFingerprint(packet.messages, stitchedPlainText),
    clientResolutionBestMatch: serializeClientResolutionBestMatch(clientResolutionState),
    productResolutionBestMatch: serializeProductResolutionBestMatch(productResolutionState),
    identity,
  };
}

export function isQuantityResolutionUpstreamReady(
  identity: QuantityResolutionSenderIdentitySnapshot,
  clientResolutionState: OperatorInboxClientResolutionState,
  productResolutionState: OperatorInboxProductResolutionState,
): boolean {
  const identityReady = identity.status === "ready" || identity.status === "error";
  const clientReady =
    clientResolutionState.status === "ready" || clientResolutionState.status === "error";
  const productReady =
    productResolutionState.status === "ready" || productResolutionState.status === "error";
  return identityReady && clientReady && productReady;
}

export function buildQuantityResolutionFetchInput(
  packet: QuantityResolutionPacketSnapshot,
  stitchedPlainText: string,
  productResolutionState?: OperatorInboxProductResolutionState,
): QuantityResolutionInput {
  const snippet =
    pickLatestInboundSnippetForIdentifySender(packet.messages, stitchedPlainText) ?? "";
  const productId =
    productResolutionState?.status === "ready"
      ? (productResolutionState.result.bestMatch?.productId ?? null)
      : null;
  const productBestMatchName =
    productResolutionState?.status === "ready"
      ? (productResolutionState.result.bestMatch?.productName ?? null)
      : null;

  return {
    messageText: snippet,
    stitchedPlainText,
    productId,
    productBestMatchName,
  };
}

export function projectQuantityResolutionDisplayState(
  state: OperatorInboxQuantityResolutionState,
  currentRequestKey: string | null,
): OperatorInboxQuantityResolutionState {
  if (!currentRequestKey) return { status: "idle" };
  if (state.status === "idle") return { status: "idle" };
  if (state.requestKey !== currentRequestKey) {
    return { status: "loading", requestKey: currentRequestKey };
  }
  return state;
}

export function quantityResolutionStateMatchesRequestKey(
  state: OperatorInboxQuantityResolutionState,
  requestKey: string,
): boolean {
  return state.status !== "idle" && state.requestKey === requestKey;
}

export { buildPacketMessagesFingerprint };
