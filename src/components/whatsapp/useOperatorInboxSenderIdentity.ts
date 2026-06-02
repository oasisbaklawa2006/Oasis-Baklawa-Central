import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchSenderIdentity } from "@/lib/wa-governance/fetchSenderIdentity";
import type { SenderIdentityViewModel } from "@/lib/wa-governance/senderIdentityTypes";
import type { OperatorInboxPacket } from "./operatorInboxTypes";
import { packetStitchedPlainText } from "./operatorInboxUtils";

export type OperatorInboxSenderIdentityState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; identity: SenderIdentityViewModel }
  | { status: "error"; message: string };

function snippetForSpamHeuristic(packet: OperatorInboxPacket): string | undefined {
  const fromMessages = (packet.messages ?? [])
    .filter((m) => m.direction === "inbound")
    .map((m) => (m.content ?? "").trim())
    .find(Boolean);
  if (fromMessages) return fromMessages.slice(0, 280);
  const stitched = packetStitchedPlainText(packet.stitched_content).trim();
  return stitched ? stitched.slice(0, 280) : undefined;
}

export function useOperatorInboxSenderIdentity(
  selectedPacket: OperatorInboxPacket | null,
): OperatorInboxSenderIdentityState {
  const [state, setState] = useState<OperatorInboxSenderIdentityState>({ status: "idle" });

  useEffect(() => {
    if (!selectedPacket) {
      setState({ status: "idle" });
      return;
    }

    const phone = (selectedPacket.phone_number ?? "").trim();
    if (!phone || phone === "---") {
      setState({
        status: "error",
        message: "No phone number on this contact — sender identity unavailable.",
      });
      return;
    }

    const packetId = selectedPacket.id;
    let cancelled = false;
    setState({ status: "loading" });

    void (async () => {
      try {
        const identity = await fetchSenderIdentity(supabase, {
          phone_number: phone,
          wa_contact_id: selectedPacket.wa_contact_id,
          message_text: snippetForSpamHeuristic(selectedPacket),
        });
        if (cancelled || packetId !== selectedPacket.id) return;
        setState({ status: "ready", identity });
      } catch (e) {
        if (cancelled || packetId !== selectedPacket.id) return;
        const message = e instanceof Error ? e.message : "Could not resolve sender identity";
        setState({ status: "error", message });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    selectedPacket?.id,
    selectedPacket?.phone_number,
    selectedPacket?.wa_contact_id,
    selectedPacket?.stitched_content,
    selectedPacket?.messages,
  ]);

  return state;
}
