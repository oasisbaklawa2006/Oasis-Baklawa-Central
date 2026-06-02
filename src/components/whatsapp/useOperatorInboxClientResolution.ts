import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchClientResolution } from "@/lib/wa-governance/fetchClientResolution";
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
  const lookupKeyRef = useRef<string | null>(null);

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
    return `${selectedPacket.id}:${contentFingerprint}:${senderIdentityKindKey(senderIdentityState)}`;
  }, [selectedPacket?.id, contentFingerprint, senderIdentityState]);

  lookupKeyRef.current = lookupKey;

  useEffect(() => {
    if (!lookupKey || !selectedPacket) {
      setState({ status: "idle" });
      return;
    }

    if (senderIdentityState.status === "loading" || senderIdentityState.status === "idle") {
      setState({ status: "loading" });
      return;
    }

    const packet = packetRef.current;
    if (!packet) {
      setState({ status: "idle" });
      return;
    }

    const requestKey = lookupKey;
    let cancelled = false;
    setState({ status: "loading" });

    void (async () => {
      try {
        const stitched = packetStitchedPlainText(packet.stitched_content);
        const snippet = pickLatestInboundSnippetForIdentifySender(packet.messages, stitched) ?? "";
        const result = await fetchClientResolution(supabase, {
          messageText: snippet,
          stitchedPlainText: stitched,
          senderPhone: packet.phone_number,
          waContactId: packet.wa_contact_id,
          waCustomerName: packet.customer_name,
          waCompanyName: null,
          senderIdentity:
            senderIdentityState.status === "ready" ? senderIdentityState.identity : null,
        });
        if (cancelled || lookupKeyRef.current !== requestKey) return;
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
  }, [lookupKey, selectedPacket, senderIdentityState]);

  return state;
}
