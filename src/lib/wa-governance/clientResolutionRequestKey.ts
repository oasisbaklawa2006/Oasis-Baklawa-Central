import { buildClientResolutionCombinedText } from "./clientResolutionSignals";
import type { ClientResolutionInput, ClientResolutionResult } from "./clientResolutionTypes";
import { pickLatestInboundSnippetForIdentifySender } from "./senderIdentitySnippet";
import type { SenderIdentityKind, SenderIdentityViewModel } from "./senderIdentityTypes";

export type ClientResolutionPacketMessage = {
  id: string;
  direction: string;
  content: string | null;
  created_at?: string | null;
};

export type ClientResolutionPacketSnapshot = {
  id: string;
  phone_number?: string;
  wa_contact_id?: string | null;
  customer_name?: string;
  stitched_content: unknown;
  messages?: ClientResolutionPacketMessage[];
};

export type ClientResolutionSenderIdentitySnapshot =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error" }
  | {
      status: "ready";
      kind: SenderIdentityKind;
      companyName: string | null;
      customerName: string | null;
    };

export interface ClientResolutionRequestDescriptor {
  packetId: string;
  phoneNumber: string | null;
  waContactId: string | null;
  waCustomerName: string | null;
  contentFingerprint: string;
  identity: ClientResolutionSenderIdentitySnapshot;
}

export type OperatorInboxClientResolutionState =
  | { status: "idle" }
  | { status: "loading"; requestKey: string }
  | { status: "ready"; requestKey: string; result: ClientResolutionResult }
  | { status: "error"; requestKey: string; message: string };

const UNKNOWN_SENDER_IDENTITY: SenderIdentityViewModel = {
  kind: "unknown",
  confidence: null,
  normalizedPhone: null,
  employeeProfile: null,
  roleFromEdge: null,
  matchedVia: null,
  contactId: null,
  customerName: null,
  companyName: null,
  reason: "Sender identity unavailable — treating as unknown for client resolution",
};

export function hashResolutionText(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) | 0;
  }
  return String(hash);
}

export function buildPacketMessagesFingerprint(
  messages: ClientResolutionPacketMessage[] | undefined,
): string {
  return (
    messages
      ?.map(
        (message) =>
          `${message.id}:${message.direction}:${message.content ?? ""}:${message.created_at ?? ""}`,
      )
      .join("|") ?? ""
  );
}

export function buildPacketContentFingerprint(
  messages: ClientResolutionPacketMessage[] | undefined,
  stitchedPlainText: string,
): string {
  const snippet = pickLatestInboundSnippetForIdentifySender(messages, stitchedPlainText) ?? "";
  return hashResolutionText(buildClientResolutionCombinedText(snippet, stitchedPlainText));
}

export function serializeClientResolutionIdentity(
  identity: ClientResolutionSenderIdentitySnapshot,
): string {
  switch (identity.status) {
    case "idle":
      return "identity:idle";
    case "loading":
      return "identity:loading";
    case "error":
      return "identity:error";
    case "ready":
      return `identity:ready:${identity.kind}:${identity.companyName ?? ""}:${identity.customerName ?? ""}`;
  }
}

export function buildClientResolutionRequestKey(
  descriptor: ClientResolutionRequestDescriptor,
): string {
  return [
    descriptor.packetId,
    descriptor.contentFingerprint,
    descriptor.phoneNumber ?? "",
    descriptor.waContactId ?? "",
    descriptor.waCustomerName ?? "",
    serializeClientResolutionIdentity(descriptor.identity),
  ].join("|");
}

export function buildClientResolutionRequestDescriptor(
  packet: ClientResolutionPacketSnapshot | null,
  identity: ClientResolutionSenderIdentitySnapshot,
  stitchedPlainText: string,
): ClientResolutionRequestDescriptor | null {
  if (!packet) return null;
  return {
    packetId: packet.id,
    phoneNumber: packet.phone_number?.trim() || null,
    waContactId: packet.wa_contact_id ?? null,
    waCustomerName: packet.customer_name ?? null,
    contentFingerprint: buildPacketContentFingerprint(packet.messages, stitchedPlainText),
    identity,
  };
}

export function isClientResolutionIdentityReady(
  identity: ClientResolutionSenderIdentitySnapshot,
): boolean {
  return identity.status === "ready" || identity.status === "error";
}

export function resolveSenderIdentityForClientResolution(
  identity: ClientResolutionSenderIdentitySnapshot,
  readyIdentity: SenderIdentityViewModel | null,
): SenderIdentityViewModel | null {
  if (identity.status === "ready") return readyIdentity;
  if (identity.status === "error") return UNKNOWN_SENDER_IDENTITY;
  return null;
}

export function shouldScoreSenderPhoneForClientResolution(
  senderIdentity: SenderIdentityViewModel | null,
): boolean {
  if (!senderIdentity) return false;
  return senderIdentity.kind === "customer" || senderIdentity.kind === "unknown";
}

export function buildClientResolutionFetchInput(
  packet: ClientResolutionPacketSnapshot,
  descriptor: ClientResolutionRequestDescriptor,
  stitchedPlainText: string,
  readyIdentity: SenderIdentityViewModel | null,
): ClientResolutionInput {
  const snippet =
    pickLatestInboundSnippetForIdentifySender(packet.messages, stitchedPlainText) ?? "";
  const senderIdentity = resolveSenderIdentityForClientResolution(
    descriptor.identity,
    readyIdentity,
  );

  return {
    messageText: snippet,
    stitchedPlainText,
    senderPhone: packet.phone_number,
    waContactId: packet.wa_contact_id,
    waCustomerName: packet.customer_name,
    waCompanyName: senderIdentity?.companyName ?? null,
    senderIdentity,
  };
}

export function projectClientResolutionDisplayState(
  state: OperatorInboxClientResolutionState,
  currentRequestKey: string | null,
): OperatorInboxClientResolutionState {
  if (!currentRequestKey) return { status: "idle" };
  if (state.status === "idle") return { status: "idle" };
  if (state.requestKey !== currentRequestKey) {
    return { status: "loading", requestKey: currentRequestKey };
  }
  return state;
}

export function clientResolutionStateMatchesRequestKey(
  state: OperatorInboxClientResolutionState,
  requestKey: string,
): boolean {
  return state.status !== "idle" && state.requestKey === requestKey;
}
