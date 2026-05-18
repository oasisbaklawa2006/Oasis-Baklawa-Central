// supabase/functions/whatsapp-message-stitcher/index.ts
// TOOL 0: Message Stitching Layer
// Groups fragmented WhatsApp messages from same sender within configurable window

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface StitchingConfig {
  windowSeconds: number;
  batchSize: number;
}

const DEFAULT_STITCHING_CONFIG: StitchingConfig = {
  windowSeconds: 300,
  batchSize: 100,
};

async function findUnstitchedMessages(
  supabaseAdmin: ReturnType<typeof createClient>,
  batchSize: number,
) {
  const { data: messages, error } = await supabaseAdmin
    .from("whatsapp_messages")
    .select(
      "id, contact_id, direction, content, created_at, message_timestamp",
    )
    .eq("is_raw", true)
    .is("packet_id", null)
    .eq("direction", "inbound")
    .order("created_at", { ascending: true })
    .limit(batchSize);

  if (error) {
    throw new Error(`Failed to find unstitched messages: ${error.message}`);
  }

  return messages || [];
}

/** Group inbound raw rows by contact, then split into time windows. */
function groupMessagesByStitchingWindow(
  unstitchedMessages: Record<string, unknown>[],
  windowSeconds: number,
) {
  const groupedByContact: { [key: string]: Record<string, unknown>[] } = {};

  for (const msg of unstitchedMessages) {
    const contactId = String(msg.contact_id ?? "");
    if (!contactId) continue;
    if (!groupedByContact[contactId]) {
      groupedByContact[contactId] = [];
    }
    groupedByContact[contactId].push(msg);
  }

  const packets: {
    contact_id: string;
    messages: Record<string, unknown>[];
    first_message_at: string;
    last_message_at: string;
  }[] = [];

  for (const [contactId, messages] of Object.entries(groupedByContact)) {
    let currentPacket = {
      contact_id: contactId,
      messages: [] as Record<string, unknown>[],
      first_message_at: String(messages[0].created_at),
      last_message_at: String(messages[0].created_at),
    };

    for (const msg of messages) {
      const msgTime = new Date(String(msg.created_at)).getTime();
      const lastTime = new Date(currentPacket.last_message_at).getTime();
      const timeDiffSeconds = (msgTime - lastTime) / 1000;

      if (timeDiffSeconds <= windowSeconds && currentPacket.messages.length > 0) {
        currentPacket.messages.push(msg);
        currentPacket.last_message_at = String(msg.created_at);
      } else if (currentPacket.messages.length === 0) {
        currentPacket.messages.push(msg);
        currentPacket.first_message_at = String(msg.created_at);
        currentPacket.last_message_at = String(msg.created_at);
      } else {
        packets.push(currentPacket);
        currentPacket = {
          contact_id: contactId,
          messages: [msg],
          first_message_at: String(msg.created_at),
          last_message_at: String(msg.created_at),
        };
      }
    }

    if (currentPacket.messages.length > 0) {
      packets.push(currentPacket);
    }
  }

  return packets;
}

/**
 * Persists stitch metadata in `whatsapp_message_packets` and links fragment rows.
 * Requires tables/columns: whatsapp_message_packets + whatsapp_messages.packet_id, is_raw.
 */
async function persistStitchedPackets(
  supabaseAdmin: ReturnType<typeof createClient>,
  packets: ReturnType<typeof groupMessagesByStitchingWindow>,
): Promise<number> {
  let linked = 0;

  for (const packet of packets) {
    const ids = packet.messages
      .map((m) => m.id as string)
      .filter(Boolean);
    if (ids.length === 0) continue;

    const stitchedText = packet.messages
      .map((m) => String(m.content ?? "").trim())
      .filter(Boolean)
      .join("\n");

    const stitchedContent = {
      summary: `${packet.messages.length} messages stitched`,
      text: stitchedText,
    };

    const { data: row, error: insertErr } = await supabaseAdmin
      .from("whatsapp_message_packets")
      .insert({
        contact_id: packet.contact_id,
        stitched_content: stitchedContent,
        fragment_count: packet.messages.length,
        first_message_at: packet.first_message_at,
        last_message_at: packet.last_message_at,
        status: "open",
      })
      .select("id")
      .single();

    if (insertErr || !row?.id) {
      console.error(
        "[whatsapp-message-stitcher] packet insert failed:",
        insertErr?.message ?? insertErr,
      );
      throw new Error(
        insertErr?.message ||
          "Failed to insert whatsapp_message_packets (table missing?)",
      );
    }

    const stitchedAt = new Date().toISOString();
    for (let i = 0; i < ids.length; i++) {
      const { error: updateErr } = await supabaseAdmin
        .from("whatsapp_messages")
        .update({
          packet_id: row.id,
          packet_sequence: i + 1,
          is_raw: false,
          stitched_at: stitchedAt,
        })
        .eq("id", ids[i]);

      if (updateErr) {
        console.error(
          "[whatsapp-message-stitcher] fragment update failed:",
          updateErr.message,
        );
        throw new Error(updateErr.message);
      }
      linked += 1;
    }
  }

  return linked;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as Partial<StitchingConfig>;
    const cfg: StitchingConfig = {
      windowSeconds: Math.min(
        3600,
        Math.max(30, Number(body.windowSeconds) || DEFAULT_STITCHING_CONFIG.windowSeconds),
      ),
      batchSize: Math.min(
        500,
        Math.max(1, Number(body.batchSize) || DEFAULT_STITCHING_CONFIG.batchSize),
      ),
    };

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const unstitched = await findUnstitchedMessages(supabaseAdmin, cfg.batchSize);
    const packets = groupMessagesByStitchingWindow(unstitched, cfg.windowSeconds);
    const fragmentsLinked = await persistStitchedPackets(supabaseAdmin, packets);

    return new Response(
      JSON.stringify({
        success: true,
        packetsCreated: packets.length,
        messagesProcessed: unstitched.length,
        ok: true,
        config: cfg,
        raw_rows_scanned: unstitched.length,
        packets_created: packets.length,
        fragments_linked: fragmentsLinked,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[whatsapp-message-stitcher]", message);
    return new Response(
      JSON.stringify({ success: false, ok: false, error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
