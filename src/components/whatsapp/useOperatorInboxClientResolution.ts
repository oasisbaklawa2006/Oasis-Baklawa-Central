import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchClientResolution } from "@/lib/wa-governance/fetchClientResolution";
import {
  buildClientResolutionFetchInput,
  buildClientResolutionRequestDescriptor,
  buildClientResolutionRequestKey,
  buildPacketMessagesFingerprint,
  isClientResolutionIdentityReady,
  projectClientResolutionDisplayState,
  serializeClientResolutionIdentity,
  type ClientResolutionSenderIdentitySnapshot,
  type OperatorInboxClientResolutionState,
} from "@/lib/wa-governance/clientResolutionRequestKey";
import {
  getCachedClientResolutionState,
  storeCachedClientResolutionResult,
} from "@/lib/wa-governance/clientResolutionResultCache";
import type { ClientResolutionResult } from "@/lib/wa-governance/clientResolutionTypes";
import type { OperatorInboxSenderIdentityState } from "./useOperatorInboxSenderIdentity";
import type { OperatorInboxPacket } from "./operatorInboxTypes";
import { packetStitchedPlainText } from "./operatorInboxUtils";

export type { OperatorInboxClientResolutionState } from "@/lib/wa-governance/clientResolutionRequestKey";
export {
  buildClientResolutionRequestKey,
  hashResolutionText,
} from "@/lib/wa-governance/clientResolutionRequestKey";

function snapshotSenderIdentity(
  state: OperatorInboxSenderIdentityState,
): ClientResolutionSenderIdentitySnapshot {
  switch (state.status) {
    case "idle":
      return { status: "idle" };
    case "loading":
      return { status: "loading" };
    case "error":
      return { status: "error" };
    case "ready":
      return {
        status: "ready",
        kind: state.identity.kind,
        companyName: state.identity.companyName,
        customerName: state.identity.customerName,
      };
  }
}

export function buildClientResolutionLookupKey(
  packet: OperatorInboxPacket | null,
  senderIdentityState: OperatorInboxSenderIdentityState,
): string | null {
  if (!packet) return null;
  const stitchedPlainText = packetStitchedPlainText(packet.stitched_content);
  const descriptor = buildClientResolutionRequestDescriptor(
    packet,
    snapshotSenderIdentity(senderIdentityState),
    stitchedPlainText,
  );
  return descriptor ? buildClientResolutionRequestKey(descriptor) : null;
}

export function useOperatorInboxClientResolution(
  selectedPacket: OperatorInboxPacket | null,
  senderIdentityState: OperatorInboxSenderIdentityState,
): { state: OperatorInboxClientResolutionState; requestKey: string | null } {
  const [state, setState] = useState<OperatorInboxClientResolutionState>({ status: "idle" });
  const packetRef = useRef(selectedPacket);
  packetRef.current = selectedPacket;
  const senderIdentityStateRef = useRef(senderIdentityState);
  senderIdentityStateRef.current = senderIdentityState;
  const requestKeyRef = useRef<string | null>(null);
  const resolvedResultCacheRef = useRef(new Map<string, ClientResolutionResult>());

  const identitySnapshot = useMemo(
    () => snapshotSenderIdentity(senderIdentityState),
    [
      senderIdentityState.status,
      senderIdentityState.status === "ready" ? senderIdentityState.identity.kind : null,
      senderIdentityState.status === "ready" ? senderIdentityState.identity.companyName : null,
      senderIdentityState.status === "ready" ? senderIdentityState.identity.customerName : null,
    ],
  );

  const messagesFingerprintKey = useMemo(
    () => buildPacketMessagesFingerprint(selectedPacket?.messages),
    [
      selectedPacket?.messages
        ?.map(
          (message) =>
            `${message.id}:${message.direction}:${message.content ?? ""}:${message.created_at ?? ""}`,
        )
        .join("|") ?? "",
    ],
  );

  const stitchedPlainText = useMemo(() => {
    if (!selectedPacket) return "";
    return packetStitchedPlainText(selectedPacket.stitched_content);
  }, [selectedPacket?.id, selectedPacket?.stitched_content]);

  const descriptor = useMemo(() => {
    if (!selectedPacket) return null;
    return buildClientResolutionRequestDescriptor(
      selectedPacket,
      identitySnapshot,
      stitchedPlainText,
    );
  }, [
    selectedPacket?.id,
    selectedPacket?.phone_number,
    selectedPacket?.wa_contact_id,
    selectedPacket?.customer_name,
    stitchedPlainText,
    messagesFingerprintKey,
    serializeClientResolutionIdentity(identitySnapshot),
  ]);

  const requestKey = useMemo(
    () => (descriptor ? buildClientResolutionRequestKey(descriptor) : null),
    [descriptor],
  );

  requestKeyRef.current = requestKey;

  useEffect(() => {
    if (!requestKey || !descriptor) {
      setState({ status: "idle" });
      return;
    }

    if (!isClientResolutionIdentityReady(descriptor.identity)) {
      setState({ status: "loading", requestKey });
      return;
    }

    const cachedState = getCachedClientResolutionState(
      requestKey,
      resolvedResultCacheRef.current,
    );
    if (cachedState) {
      setState(cachedState);
      return;
    }

    let cancelled = false;
    setState({ status: "loading", requestKey });

    void (async () => {
      const packet = packetRef.current;
      if (!packet) return;

      const identityState = senderIdentityStateRef.current;
      const readyIdentity = identityState.status === "ready" ? identityState.identity : null;
      const stitched = packetStitchedPlainText(packet.stitched_content);

      try {
        const input = buildClientResolutionFetchInput(
          packet,
          descriptor,
          stitched,
          readyIdentity,
        );
        const result = await fetchClientResolution(supabase, input);
        if (cancelled || requestKeyRef.current !== requestKey) return;
        storeCachedClientResolutionResult(resolvedResultCacheRef.current, requestKey, result);
        setState({ status: "ready", requestKey, result });
      } catch (e) {
        if (cancelled || requestKeyRef.current !== requestKey) return;
        const message = e instanceof Error ? e.message : "Could not resolve likely client";
        setState({ status: "error", requestKey, message });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [requestKey]);

  return useMemo(
    () => ({
      requestKey,
      state: projectClientResolutionDisplayState(state, requestKey),
    }),
    [state, requestKey],
  );
}
