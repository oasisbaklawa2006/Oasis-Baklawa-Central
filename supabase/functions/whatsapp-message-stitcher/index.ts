// WhatsApp packet orchestrator.
// Packet mutation authority belongs to Core RPC stitch_whatsapp_messages_atomic;
// this Edge Function only discovers and groups unstitched inbound rows.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { groupMessagesByStitchingWindow } from "../_shared/whatsappStitchingWindow.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type UnstitchedMessage = {
  id: string;
  contact_id: string;
  direction: string;
  content: string | null;
  created_at: string;
  message_timestamp: string | null;
  provider_message_id: string | null;
};

const DEFAULT_WINDOW_SECONDS = 300;
const DEFAULT_BATCH_SIZE = 100;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const body = await req.json().catch(() => ({})) as { windowSeconds?: number; batchSize?: number };
    const windowSeconds = Math.min(3600, Math.max(30, Number(body.windowSeconds) || DEFAULT_WINDOW_SECONDS));
    const batchSize = Math.min(500, Math.max(1, Number(body.batchSize) || DEFAULT_BATCH_SIZE));
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data, error } = await admin
      .from("whatsapp_messages")
      .select("id, contact_id, direction, content, created_at, message_timestamp, provider_message_id")
      .eq("is_raw", true)
      .is("packet_id", null)
      .eq("direction", "inbound")
      .order("created_at", { ascending: true })
      .limit(batchSize);
    if (error) throw new Error(`Failed to find unstitched messages: ${error.message}`);

    const unstitched = (data ?? []) as UnstitchedMessage[];
    const invalidContactRows = unstitched.filter((message) =>
      typeof message.contact_id !== "string" || message.contact_id.trim().length === 0
    );
    if (invalidContactRows.length > 0) {
      const invalidIds = invalidContactRows.map((message) => message.id).join(", ");
      throw new Error(`Unstitched inbound messages missing contact authority: ${invalidIds}`);
    }

    const groupsByContact = groupMessagesByStitchingWindow(unstitched, windowSeconds);
    let groupsProcessed = 0;
    let fragmentsLinked = 0;
    const packetIds: string[] = [];

    for (const contact of groupsByContact) {
      for (const group of contact.groups) {
        if (group.messages.length === 0) continue;
        const { data: packetId, error: rpcError } = await admin.rpc("stitch_whatsapp_messages_atomic", {
          p_contact_id: contact.contact_id,
          p_message_ids: group.messages.map((m) => m.id),
          p_window_seconds: windowSeconds,
        });
        if (rpcError || !packetId) {
          throw new Error(`Core packet authority failed for contact ${contact.contact_id}: ${rpcError?.message ?? "missing packet id"}`);
        }
        packetIds.push(String(packetId));
        groupsProcessed += 1;
        fragmentsLinked += group.messages.length;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      ok: true,
      messagesProcessed: unstitched.length,
      groupsProcessed,
      fragmentsLinked,
      packetIds,
      config: { windowSeconds, batchSize },
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[whatsapp-message-stitcher]", message);
    return new Response(JSON.stringify({ success: false, ok: false, error: message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
