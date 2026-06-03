import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchQuantityResolution } from "@/lib/wa-governance/fetchQuantityResolution";
import {
  buildQuantityResolutionFetchInput,
  buildQuantityResolutionRequestDescriptor,
  buildQuantityResolutionRequestKey,
  buildPacketMessagesFingerprint,
  isQuantityResolutionUpstreamReady,
  projectQuantityResolutionDisplayState,
  serializeProductResolutionBestMatch,
  type OperatorInboxQuantityResolutionState,
  type QuantityResolutionSenderIdentitySnapshot,
} from "@/lib/wa-governance/quantityResolutionRequestKey";
import {
  getCachedQuantityResolutionState,
  storeCachedQuantityResolutionResult,
} from "@/lib/wa-governance/quantityResolutionResultCache";
import type { QuantityResolutionResult } from "@/lib/wa-governance/quantityResolutionTypes";
import { serializeClientResolutionIdentity } from "@/lib/wa-governance/clientResolutionRequestKey";
import type { OperatorInboxClientResolutionState } from "@/lib/wa-governance/clientResolutionRequestKey";
import type { OperatorInboxProductResolutionState } from "@/lib/wa-governance/productResolutionRequestKey";
import type { OperatorInboxSenderIdentityState } from "./useOperatorInboxSenderIdentity";
import type { OperatorInboxPacket } from "./operatorInboxTypes";
import { packetStitchedPlainText } from "./operatorInboxUtils";

export type { OperatorInboxQuantityResolutionState } from "@/lib/wa-governance/quantityResolutionRequestKey";

function snapshotSenderIdentity(
  state: OperatorInboxSenderIdentityState,
): QuantityResolutionSenderIdentitySnapshot {
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

function clientResolutionBestMatchKey(state: OperatorInboxClientResolutionState): string {
  if (state.status === "loading" || state.status === "idle") return "pending";
  if (state.status === "error") return "error";
  if (!state.result.bestMatch) return "none";
  return `${state.result.bestMatch.companyId}:${state.result.bestMatch.companyName}`;
}

function productResolutionBestMatchKey(state: OperatorInboxProductResolutionState): string {
  if (state.status === "loading" || state.status === "idle") return "pending";
  if (state.status === "error") return "error";
  if (!state.result.bestMatch) return "none";
  return `${state.result.bestMatch.productId}:${state.result.bestMatch.productName}`;
}

export function useOperatorInboxQuantityResolution(
  selectedPacket: OperatorInboxPacket | null,
  senderIdentityState: OperatorInboxSenderIdentityState,
  clientResolutionState: OperatorInboxClientResolutionState,
  productResolutionState: OperatorInboxProductResolutionState,
): { state: OperatorInboxQuantityResolutionState; requestKey: string | null } {
  const [state, setState] = useState<OperatorInboxQuantityResolutionState>({ status: "idle" });
  const packetRef = useRef(selectedPacket);
  packetRef.current = selectedPacket;
  const productResolutionStateRef = useRef(productResolutionState);
  productResolutionStateRef.current = productResolutionState;
  const requestKeyRef = useRef<string | null>(null);
  const resolvedResultCacheRef = useRef(new Map<string, QuantityResolutionResult>());

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

  const clientMatchKey = useMemo(
    () => clientResolutionBestMatchKey(clientResolutionState),
    [
      clientResolutionState.status,
      clientResolutionState.status === "ready"
        ? clientResolutionState.result.bestMatch?.companyId
        : null,
      clientResolutionState.status === "ready"
        ? clientResolutionState.result.bestMatch?.companyName
        : null,
    ],
  );

  const productMatchKey = useMemo(
    () => productResolutionBestMatchKey(productResolutionState),
    [
      productResolutionState.status,
      productResolutionState.status === "ready"
        ? productResolutionState.result.bestMatch?.productId
        : null,
      productResolutionState.status === "ready"
        ? productResolutionState.result.bestMatch?.productName
        : null,
    ],
  );

  const descriptor = useMemo(() => {
    if (!selectedPacket) return null;
    return buildQuantityResolutionRequestDescriptor(
      selectedPacket,
      identitySnapshot,
      stitchedPlainText,
      clientResolutionState,
      productResolutionState,
    );
  }, [
    selectedPacket?.id,
    stitchedPlainText,
    messagesFingerprintKey,
    serializeClientResolutionIdentity(identitySnapshot),
    clientMatchKey,
    clientResolutionState.status,
    serializeProductResolutionBestMatch(productResolutionState),
    productMatchKey,
    productResolutionState.status,
  ]);

  const requestKey = useMemo(
    () => (descriptor ? buildQuantityResolutionRequestKey(descriptor) : null),
    [descriptor],
  );

  requestKeyRef.current = requestKey;

  useEffect(() => {
    if (!requestKey || !descriptor) {
      setState({ status: "idle" });
      return;
    }

    if (
      !isQuantityResolutionUpstreamReady(
        descriptor.identity,
        clientResolutionState,
        productResolutionState,
      )
    ) {
      setState({ status: "loading", requestKey });
      return;
    }

    const cachedState = getCachedQuantityResolutionState(
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

      const stitched = packetStitchedPlainText(packet.stitched_content);

      try {
        const input = buildQuantityResolutionFetchInput(
          packet,
          stitched,
          productResolutionStateRef.current,
        );
        const result = await fetchQuantityResolution(supabase, input);
        if (cancelled || requestKeyRef.current !== requestKey) return;
        storeCachedQuantityResolutionResult(resolvedResultCacheRef.current, requestKey, result);
        setState({ status: "ready", requestKey, result });
      } catch (e) {
        if (cancelled || requestKeyRef.current !== requestKey) return;
        const message = e instanceof Error ? e.message : "Could not resolve quantities";
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
      state: projectQuantityResolutionDisplayState(state, requestKey),
    }),
    [state, requestKey],
  );
}
