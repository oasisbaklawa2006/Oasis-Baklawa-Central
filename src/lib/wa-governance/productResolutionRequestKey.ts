import {
  buildPacketContentFingerprint,
  buildPacketMessagesFingerprint,
  type ClientResolutionPacketMessage,
  type ClientResolutionPacketSnapshot,
  type ClientResolutionSenderIdentitySnapshot,
  type OperatorInboxClientResolutionState,
  serializeClientResolutionIdentity,
} from "./clientResolutionRequestKey";
import { pickLatestInboundSnippetForIdentifySender } from "./senderIdentitySnippet";
import type { ProductResolutionResult } from "./productResolutionTypes";

export type ProductResolutionPacketSnapshot = ClientResolutionPacketSnapshot;
export type ProductResolutionPacketMessage = ClientResolutionPacketMessage;
export type ProductResolutionSenderIdentitySnapshot = ClientResolutionSenderIdentitySnapshot;

export interface ProductResolutionRequestDescriptor {
  packetId: string;
  contentFingerprint: string;
  clientResolutionBestMatch: string;
  identity: ProductResolutionSenderIdentitySnapshot;
}

export type OperatorInboxProductResolutionState =
  | { status: "idle" }
  | { status: "loading"; requestKey: string }
  | { status: "ready"; requestKey: string; result: ProductResolutionResult }
  | { status: "error"; requestKey: string; message: string };

export function serializeClientResolutionBestMatch(
  clientResolutionState: OperatorInboxClientResolutionState,
): string {
  if (
    clientResolutionState.status === "loading" ||
    clientResolutionState.status === "idle"
  ) {
    return "client:pending";
  }
  if (clientResolutionState.status === "error") return "client:error";
  const best = clientResolutionState.result.bestMatch;
  if (!best) return "client:none";
  return `client:${best.companyId}:${best.companyName}`;
}

export function buildProductResolutionRequestKey(
  descriptor: ProductResolutionRequestDescriptor,
): string {
  return [
    descriptor.packetId,
    descriptor.contentFingerprint,
    descriptor.clientResolutionBestMatch,
    serializeClientResolutionIdentity(descriptor.identity),
  ].join("|");
}

export function buildProductResolutionRequestDescriptor(
  packet: ProductResolutionPacketSnapshot | null,
  identity: ProductResolutionSenderIdentitySnapshot,
  stitchedPlainText: string,
  clientResolutionState: OperatorInboxClientResolutionState,
): ProductResolutionRequestDescriptor | null {
  if (!packet) return null;
  return {
    packetId: packet.id,
    contentFingerprint: buildPacketContentFingerprint(packet.messages, stitchedPlainText),
    clientResolutionBestMatch: serializeClientResolutionBestMatch(clientResolutionState),
    identity,
  };
}

export function isProductResolutionUpstreamReady(
  identity: ProductResolutionSenderIdentitySnapshot,
  clientResolutionState: OperatorInboxClientResolutionState,
): boolean {
  const identityReady = identity.status === "ready" || identity.status === "error";
  const clientReady =
    clientResolutionState.status === "ready" || clientResolutionState.status === "error";
  return identityReady && clientReady;
}

export function buildProductResolutionFetchInput(
  packet: ProductResolutionPacketSnapshot,
  stitchedPlainText: string,
  clientResolutionState: OperatorInboxClientResolutionState,
): {
  messageText: string;
  stitchedPlainText: string;
  clientCompanyId: string | null;
  clientCompanyName: string | null;
} {
  const snippet =
    pickLatestInboundSnippetForIdentifySender(packet.messages, stitchedPlainText) ?? "";
  const best =
    clientResolutionState.status === "ready" ? clientResolutionState.result.bestMatch : null;

  return {
    messageText: snippet,
    stitchedPlainText,
    clientCompanyId: best?.companyId ?? null,
    clientCompanyName: best?.companyName ?? null,
  };
}

export function projectProductResolutionDisplayState(
  state: OperatorInboxProductResolutionState,
  currentRequestKey: string | null,
): OperatorInboxProductResolutionState {
  if (!currentRequestKey) return { status: "idle" };
  if (state.status === "idle") return { status: "idle" };
  if (state.requestKey !== currentRequestKey) {
    return { status: "loading", requestKey: currentRequestKey };
  }
  return state;
}

export function productResolutionStateMatchesRequestKey(
  state: OperatorInboxProductResolutionState,
  requestKey: string,
): boolean {
  return state.status !== "idle" && state.requestKey === requestKey;
}

export { buildPacketMessagesFingerprint };
