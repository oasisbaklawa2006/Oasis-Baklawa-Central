import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchSenderIdentity } from "@/lib/wa-governance/fetchSenderIdentity";
import { pickLatestInboundSnippetForIdentifySender } from "@/lib/wa-governance/senderIdentitySnippet";
import type { SenderIdentityViewModel } from "@/lib/wa-governance/senderIdentityTypes";
import type { OperatorInboxPacket } from "./operatorInboxTypes";
import { packetStitchedPlainText } from "./operatorInboxUtils";

export type OperatorInboxSenderIdentityState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; identity: SenderIdentityViewModel }
  | { status: "error"; message: string };

const NO_PHONE_ERROR = "No phone number on this contact — sender identity unavailable.";

function buildIdentityLookupKey(packet: OperatorInboxPacket | null): string | null {
  if (!packet) return null;
  const phone = (packet.phone_number ?? "").trim();
  if (!phone || phone === "---") return `__no_phone__:${packet.id}`;
  return `${packet.id}:${phone}:${packet.wa_contact_id ?? ""}`;
}

export function useOperatorInboxSenderIdentity(
  selectedPacket: OperatorInboxPacket | null,
): OperatorInboxSenderIdentityState {
  const [state, setState] = useState<OperatorInboxSenderIdentityState>({ status: "idle" });
  const packetRef = useRef(selectedPacket);
  packetRef.current = selectedPacket;

  const lookupKey = useMemo(
    () => buildIdentityLookupKey(selectedPacket),
    [selectedPacket?.id, selectedPacket?.phone_number, selectedPacket?.wa_contact_id],
  );

  useEffect(() => {
    if (!lookupKey) {
      setState({ status: "idle" });
      return;
    }

    if (lookupKey.startsWith("__no_phone__:")) {
      setState({ status: "error", message: NO_PHONE_ERROR });
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
        const phone = (packet.phone_number ?? "").trim();
        const identity = await fetchSenderIdentity(supabase, {
          phone_number: phone,
          wa_contact_id: packet.wa_contact_id,
          message_text: pickLatestInboundSnippetForIdentifySender(
            packet.messages,
            packetStitchedPlainText(packet.stitched_content),
          ),
        });
        if (cancelled || buildIdentityLookupKey(packetRef.current) !== requestKey) return;
        setState({ status: "ready", identity });
      } catch (e) {
        if (cancelled || buildIdentityLookupKey(packetRef.current) !== requestKey) return;
        const message = e instanceof Error ? e.message : "Could not resolve sender identity";
        setState({ status: "error", message });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [lookupKey]);

  return state;
}
