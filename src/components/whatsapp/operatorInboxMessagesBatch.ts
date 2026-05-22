import { supabase } from "@/integrations/supabase/client";
import type { Message } from "./operatorInboxTypes";

const CHUNK = 55;

/**
 * Load messages for many packets in a small number of read-only round-trips
 * (for large open-packet lists without N-per-packet queries).
 */
export async function fetchMessagesForPacketIdsBatch(packetIds: string[]): Promise<Map<string, Message[]>> {
  const byPacket = new Map<string, Message[]>();
  for (const id of packetIds) {
    byPacket.set(id, []);
  }

  for (let i = 0; i < packetIds.length; i += CHUNK) {
    const chunk = packetIds.slice(i, i + CHUNK);
    if (chunk.length === 0) continue;

    const { data, error } = await supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .from("whatsapp_messages" as any)
      .select(
        "id, content, message_type, direction, created_at, packet_sequence, status, provider, packet_id",
      )
      .in("packet_id", chunk);

    if (error) {
      console.warn("[OperatorInbox] batched messages load:", error.message);
      continue;
    }

    const rows = (data ?? []) as unknown as Message[];
    for (const m of rows) {
      const pid = m.packet_id != null ? String(m.packet_id) : "";
      if (!pid || !byPacket.has(pid)) continue;
      byPacket.get(pid)!.push(m);
    }
  }

  for (const arr of byPacket.values()) {
    arr.sort((a, b) => (a.packet_sequence ?? 0) - (b.packet_sequence ?? 0));
  }

  return byPacket;
}
