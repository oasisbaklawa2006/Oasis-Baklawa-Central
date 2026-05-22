import { supabase } from "@/integrations/supabase/client";
import type { Message } from "./operatorInboxTypes";

const PACKET_ID_CHUNK = 55;
/** PostgREST default max rows is often 1000; page below that and keep fetching until a short page. */
const MESSAGES_PAGE_SIZE = 900;

export type BatchMessagesForPacketsResult = {
  byPacket: Map<string, Message[]>;
  /** Non-fatal load issues (e.g. a paged slice failed); callers may surface in UI. */
  errors: string[];
};

/**
 * Load messages for many packets in bounded read-only round-trips.
 * Paginates each packet-id batch so we do not silently truncate at PostgREST's default row cap.
 */
export async function fetchMessagesForPacketIdsBatch(
  packetIds: string[],
): Promise<BatchMessagesForPacketsResult> {
  const errors: string[] = [];
  const byPacket = new Map<string, Message[]>();
  for (const id of packetIds) {
    byPacket.set(id, []);
  }

  for (let i = 0; i < packetIds.length; i += PACKET_ID_CHUNK) {
    const chunk = packetIds.slice(i, i + PACKET_ID_CHUNK);
    if (chunk.length === 0) continue;

    let from = 0;
    for (;;) {
      const { data, error } = await supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from("whatsapp_messages" as any)
        .select(
          "id, content, message_type, direction, created_at, packet_sequence, status, provider, packet_id",
        )
        .in("packet_id", chunk)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, from + MESSAGES_PAGE_SIZE - 1);

      if (error) {
        const msg = `batched messages (packets ${i}-${i + chunk.length - 1}, rows ${from}-${from + MESSAGES_PAGE_SIZE - 1}): ${error.message}`;
        console.warn("[OperatorInbox]", msg);
        errors.push(msg);
        break;
      }

      const rows = (data ?? []) as unknown as Message[];
      for (const m of rows) {
        const pid = m.packet_id != null ? String(m.packet_id) : "";
        if (!pid || !byPacket.has(pid)) continue;
        byPacket.get(pid)!.push(m);
      }

      if (rows.length < MESSAGES_PAGE_SIZE) break;
      from += MESSAGES_PAGE_SIZE;
    }
  }

  for (const arr of byPacket.values()) {
    arr.sort((a, b) => {
      const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
      const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
      if (ta !== tb) return ta - tb;
      return (a.packet_sequence ?? 0) - (b.packet_sequence ?? 0);
    });
  }

  return { byPacket, errors };
}
