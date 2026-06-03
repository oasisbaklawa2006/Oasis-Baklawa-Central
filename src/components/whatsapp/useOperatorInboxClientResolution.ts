import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchClientResolution } from "@/lib/wa-governance/fetchClientResolution";
import {
  getCachedClientResolutionState,
  storeCachedClientResolutionResult,
} from "@/lib/wa-governance/clientResolutionResultCache";
import { buildClientResolutionCombinedText } from "@/lib/wa-governance/clientResolutionSignals";
import type { ClientResolutionResult } from "@/lib/wa-governance/clientResolutionTypes";
import { pickLatestInboundSnippetForIdentifySender } from "@/lib/wa-governance/senderIdentitySnippet";
import type { OperatorInboxSenderIdentityState } from "./useOperatorInboxSenderIdentity";
import type { OperatorInboxPacket } from "./operatorInboxTypes";
import { packetStitchedPlainText } from "./operatorInboxUtils";

export type OperatorInboxClientResolutionState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; result: ClientResolutionResult }
  | { status: "error"; message: string };

export function hashResolutionText(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) | 0;
  }
  return String(hash);
}

function packetContentFingerprint(packet: OperatorInboxPacket): string {
  const stitched = packetStitchedPlainText(packet.stitched_content);
  const snippet = pickLatestInboundSnippetForIdentifySender(packet.messages, stitched) ?? "";
  return hashResolutionText(buildClientResolutionCombinedText(snippet, stitched));
}

function senderIdentityKindKey(state: OperatorInboxSenderIdentityState): string {
  if (state.status === "ready") return state.identity.kind;
  if (state.status === "error") return "identity_error";
  if (state.status === "loading") return "identity_pending";
  return "identity_idle";
}

export function buildClientResolutionLookupKey(
  packet: OperatorInboxPacket | null,
  senderIdentityState: OperatorInboxSenderIdentityState,
): string | null {
  if (!packet) return null;
  return `${packet.id}:${packetContentFingerprint(packet)}:${senderIdentityKindKey(senderIdentityState)}`;
}

export function useOperatorInboxClientResolution(
  selectedPacket: OperatorInboxPacket | null,
  senderIdentityState: OperatorInboxSenderIdentityState,
): OperatorInboxClientResolutionState {
  const [state, setState] = useState<OperatorInboxClientResolutionState>({ status: "idle" });
  const packetRef = useRef(selectedPacket);
  packetRef.current = selectedPacket;
  const senderIdentityStateRef = useRef(senderIdentityState);
  senderIdentityStateRef.current = senderIdentityState;
  const lookupKeyRef = useRef<string | null>(null);
  const resolvedResultCacheRef = useRef(new Map<string, ClientResolutionResult>());

  const identityKindKey = useMemo(() => senderIdentityKindKey(senderIdentityState), [
    senderIdentityState.status,
    senderIdentityState.status === "ready" ? senderIdentityState.identity.kind : null,
    senderIdentityState.status === "ready" ? senderIdentityState.identity.companyName : null,
  ]);

  const contentFingerprint = useMemo(() => {
    if (!selectedPacket) return null;
    return packetContentFingerprint(selectedPacket);
  }, [
    selectedPacket?.id,
    selectedPacket?.stitched_content,
    selectedPacket?.messages
      ?.map((message) => `${message.id}:${message.direction}:${message.content ?? ""}:${message.created_at ?? ""}`)
      .join("|") ?? "",
  ]);

  const lookupKey = useMemo(() => {
    if (!selectedPacket || contentFingerprint == null) return null;
    return `${selectedPacket.id}:${contentFingerprint}:${identityKindKey}`;
  }, [selectedPacket?.id, contentFingerprint, identityKindKey]);

  lookupKeyRef.current = lookupKey;

  useEffect(() => {
    if (!lookupKey) {
      setState({ status: "idle" });
      return;
    }

    const identityState = senderIdentityStateRef.current;
    if (identityState.status === "loading" || identityState.status === "idle") {
      setState({ status: "loading" });
      return;
    }

    const packet = packetRef.current;
    if (!packet) {
      setState({ status: "idle" });
      return;
    }

    const requestKey = lookupKey;
    const cachedState = getCachedClientResolutionState(
      requestKey,
      resolvedResultCacheRef.current,
    );
    if (cachedState) {
      setState(cachedState);
      return;
    }

    let cancelled = false;
    setState({ status: "loading" });

    void (async () => {
      try {
        const stitched = packetStitchedPlainText(packet.stitched_content);
        const snippet = pickLatestInboundSnippetForIdentifySender(packet.messages, stitched) ?? "";
        const latestIdentityState = senderIdentityStateRef.current;
        const senderIdentity =
          latestIdentityState.status === "ready" ? latestIdentityState.identity : null;
        const result = await fetchClientResolution(supabase, {
          messageText: snippet,
          stitchedPlainText: stitched,
          senderPhone: packet.phone_number,
          waContactId: packet.wa_contact_id,
          waCustomerName: packet.customer_name,
          waCompanyName: senderIdentity?.companyName ?? null,
          senderIdentity,
        });
        if (cancelled || lookupKeyRef.current !== requestKey) return;
        storeCachedClientResolutionResult(resolvedResultCacheRef.current, requestKey, result);
        setState({ status: "ready", result });
      } catch (e) {
        if (cancelled || lookupKeyRef.current !== requestKey) return;
        const message = e instanceof Error ? e.message : "Could not resolve likely client";
        setState({ status: "error", message });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [lookupKey]);

  return state;
}
