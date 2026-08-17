import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchProductResolution } from "@/lib/wa-governance/fetchProductResolution";
import { interpretPacketContentRich } from "@/lib/wa-governance/packetContentInterpretation";
import { fetchLatestPacketAiInterpretation } from "@/lib/wa-governance/packetAiInterpretationPersistence";
import {
  buildProductResolutionFetchInput,
  buildProductResolutionRequestDescriptor,
  buildProductResolutionRequestKey,
  buildPacketMessagesFingerprint,
  projectProductResolutionDisplayState,
  type OperatorInboxProductResolutionState,
  type ProductResolutionSenderIdentitySnapshot,
} from "@/lib/wa-governance/productResolutionRequestKey";
import { serializeClientResolutionIdentity } from "@/lib/wa-governance/clientResolutionRequestKey";
import {
  getCachedProductResolutionState,
  storeCachedProductResolutionResult,
} from "@/lib/wa-governance/productResolutionResultCache";
import type { ProductResolutionResult } from "@/lib/wa-governance/productResolutionTypes";
import type { OperatorInboxClientResolutionState } from "@/lib/wa-governance/clientResolutionRequestKey";
import type { OperatorInboxSenderIdentityState } from "./useOperatorInboxSenderIdentity";
import type { OperatorInboxPacket } from "./operatorInboxTypes";
import { packetStitchedPlainText } from "./operatorInboxUtils";

export type { OperatorInboxProductResolutionState } from "@/lib/wa-governance/productResolutionRequestKey";

function snapshotSenderIdentity(
  state: OperatorInboxSenderIdentityState,
): ProductResolutionSenderIdentitySnapshot {
  switch (state.status) {
    case "idle": return { status: "idle" };
    case "loading": return { status: "loading" };
    case "error": return { status: "error" };
    case "ready":
      return {
        status: "ready",
        kind: state.identity.kind,
        companyName: state.identity.companyName,
        customerName: state.identity.customerName,
      };
  }
}

function clientResolutionBestMatchKey(state: OperatorInboxClientResolutionState): string {
  if (state.status === "loading" || state.status === "idle") return "pending";
  if (state.status === "error") return "error";
  if (!state.result.bestMatch) return "none";
  return `${state.result.bestMatch.companyId}:${state.result.bestMatch.companyName}`;
}

export function useOperatorInboxProductResolution(
  selectedPacket: OperatorInboxPacket | null,
  senderIdentityState: OperatorInboxSenderIdentityState,
  clientResolutionState: OperatorInboxClientResolutionState,
): { state: OperatorInboxProductResolutionState; requestKey: string | null } {
  const [state, setState] = useState<OperatorInboxProductResolutionState>({ status: "idle" });
  const packetRef = useRef(selectedPacket);
  packetRef.current = selectedPacket;
  const clientResolutionStateRef = useRef(clientResolutionState);
  clientResolutionStateRef.current = clientResolutionState;
  const requestKeyRef = useRef<string | null>(null);
  const resolvedResultCacheRef = useRef(new Map<string, ProductResolutionResult>());

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
        ?.map((message) => `${message.id}:${message.direction}:${message.content ?? ""}:${message.media_url ?? ""}:${message.created_at ?? ""}`)
        .join("|") ?? "",
    ],
  );

  const stitchedPlainText = useMemo(() => {
    if (!selectedPacket) return "";
    return packetStitchedPlainText(selectedPacket.stitched_content);
  }, [selectedPacket?.id, selectedPacket?.stitched_content]);

  const clientMatchKey = useMemo(
    () => clientResolutionBestMatchKey(clientResolutionState),
    [
      clientResolutionState.status,
      clientResolutionState.status === "ready" ? clientResolutionState.result.bestMatch?.companyId : null,
      clientResolutionState.status === "ready" ? clientResolutionState.result.bestMatch?.companyName : null,
    ],
  );

  const descriptor = useMemo(() => {
    if (!selectedPacket) return null;
    return buildProductResolutionRequestDescriptor(
      selectedPacket,
      identitySnapshot,
      stitchedPlainText,
      clientResolutionState,
    );
  }, [
    selectedPacket?.id,
    stitchedPlainText,
    messagesFingerprintKey,
    serializeClientResolutionIdentity(identitySnapshot),
    clientMatchKey,
    clientResolutionState.status,
  ]);

  const requestKey = useMemo(
    () => (descriptor ? buildProductResolutionRequestKey(descriptor) : null),
    [descriptor],
  );
  requestKeyRef.current = requestKey;

  useEffect(() => {
    if (!requestKey || !descriptor) {
      setState({ status: "idle" });
      return;
    }

    const cachedState = getCachedProductResolutionState(requestKey, resolvedResultCacheRef.current);
    if (cachedState) {
      setState(cachedState);
      return;
    }

    let cancelled = false;
    setState({ status: "loading", requestKey });

    void (async () => {
      const packet = packetRef.current;
      if (!packet) return;
      const stitched = packetStitchedPlainText(packet.stitched_content);
      const clientState = clientResolutionStateRef.current;

      try {
        // Server-computed packet intelligence is primary. Browser invocation remains
        // a read-only compatibility fallback for historical packets that predate the
        // automatic worker; UI availability is never the processing authority.
        const persisted = await fetchLatestPacketAiInterpretation(supabase, packet.id);
        const interpretation = persisted ?? await interpretPacketContentRich(supabase, packet.messages);
        if (cancelled || requestKeyRef.current !== requestKey) return;

        const resolutionText = [stitched, interpretation.normalizedText]
          .filter(Boolean)
          .join("\n")
          .slice(0, 12000);
        const input = buildProductResolutionFetchInput(packet, resolutionText, clientState);
        const productResult = await fetchProductResolution(supabase, input);
        if (cancelled || requestKeyRef.current !== requestKey) return;

        const result: ProductResolutionResult = {
          ...productResult,
          aiInterpretation: {
            conclusion: interpretation.conclusion,
            confidence: interpretation.confidence,
            language: interpretation.language,
            warnings: interpretation.warnings,
            normalizedText: interpretation.normalizedText,
            extractedText: interpretation.extractedText,
            source: persisted ? "server" : "client-fallback",
            usedAi: interpretation.usedAi,
            ...(interpretation.error ? { error: interpretation.error } : {}),
          },
        };
        storeCachedProductResolutionResult(resolvedResultCacheRef.current, requestKey, result);
        setState({ status: "ready", requestKey, result });
      } catch (e) {
        if (cancelled || requestKeyRef.current !== requestKey) return;
        const message = e instanceof Error ? e.message : "Could not resolve likely product";
        setState({ status: "error", requestKey, message });
      }
    })();

    return () => { cancelled = true; };
  }, [requestKey]);

  return useMemo(
    () => ({ requestKey, state: projectProductResolutionDisplayState(state, requestKey) }),
    [state, requestKey],
  );
}
