import {
  serializeClientResolutionBestMatch,
  type OperatorInboxProductResolutionState,
} from "./productResolutionRequestKey";
import {
  serializeProductResolutionBestMatch,
  type OperatorInboxQuantityResolutionState,
} from "./quantityResolutionRequestKey";
import type { OperatorInboxClientResolutionState } from "./clientResolutionRequestKey";

export function buildDraftOrderExtractionRequestKey(args: {
  packetId: string;
  contentFingerprint: string;
  clientResolutionState: OperatorInboxClientResolutionState;
  productResolutionState: OperatorInboxProductResolutionState;
  quantityResolutionState: OperatorInboxQuantityResolutionState;
  senderIdentityKey: string;
}): string {
  return [
    args.packetId,
    args.contentFingerprint,
    serializeClientResolutionBestMatch(args.clientResolutionState),
    serializeProductResolutionBestMatch(args.productResolutionState),
    args.quantityResolutionState.status === "ready"
      ? `qty:${args.quantityResolutionState.requestKey}`
      : `qty:${args.quantityResolutionState.status}`,
    args.senderIdentityKey,
  ].join("|");
}

export function isDraftOrderExtractionUpstreamReady(args: {
  clientResolutionState: OperatorInboxClientResolutionState;
  productResolutionState: OperatorInboxProductResolutionState;
  quantityResolutionState: OperatorInboxQuantityResolutionState;
}): boolean {
  const clientReady =
    args.clientResolutionState.status === "ready" || args.clientResolutionState.status === "error";
  const productReady =
    args.productResolutionState.status === "ready" || args.productResolutionState.status === "error";
  const quantityReady =
    args.quantityResolutionState.status === "ready" || args.quantityResolutionState.status === "error";
  return clientReady && productReady && quantityReady;
}

export function isDraftOrderExtractionUpstreamLoading(args: {
  clientResolutionState: OperatorInboxClientResolutionState;
  productResolutionState: OperatorInboxProductResolutionState;
  quantityResolutionState: OperatorInboxQuantityResolutionState;
}): boolean {
  return (
    args.clientResolutionState.status === "loading" ||
    args.productResolutionState.status === "loading" ||
    args.quantityResolutionState.status === "loading" ||
    args.clientResolutionState.status === "idle" ||
    args.productResolutionState.status === "idle" ||
    args.quantityResolutionState.status === "idle"
  );
}

export function firstUpstreamErrorMessage(args: {
  clientResolutionState: OperatorInboxClientResolutionState;
  productResolutionState: OperatorInboxProductResolutionState;
  quantityResolutionState: OperatorInboxQuantityResolutionState;
}): string | null {
  if (args.clientResolutionState.status === "error") return args.clientResolutionState.message;
  if (args.productResolutionState.status === "error") return args.productResolutionState.message;
  if (args.quantityResolutionState.status === "error") return args.quantityResolutionState.message;
  return null;
}
