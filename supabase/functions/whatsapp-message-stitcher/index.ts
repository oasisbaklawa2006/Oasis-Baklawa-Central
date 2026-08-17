// WhatsApp packet orchestrator.
// Packet mutation authority belongs to Core RPC stitch_whatsapp_messages_atomic;
// this Edge Function discovers/groups inbound rows, backfills packet-complete
// commercial evidence, then invokes the Core-owned AI worker automatically.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.45.0";
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

type SourceMessage = {
  id: string;
  provider_message_id: string;
  message_type: string | null;
};

const DEFAULT_WINDOW_SECONDS = 300;
const DEFAULT_BATCH_SIZE = 100;
const AI_WORKER_CONCURRENCY = 3;

async function syncCommercialEvidenceForPacket(
  admin: SupabaseClient,
  packetId: string,
): Promise<{ linked: number; potentialOrderId: string | null }> {
  const { data: packetMessages, error: packetMessagesError } = await admin
    .from("whatsapp_messages")
    .select("provider_message_id")
    .eq("packet_id", packetId)
    .eq("direction", "inbound")
    .order("packet_sequence", { ascending: true });
  if (packetMessagesError) throw new Error(`Packet evidence lookup failed: ${packetMessagesError.message}`);

  const providerIds = [...new Set((packetMessages ?? [])
    .map((row) => String(row.provider_message_id ?? "").trim())
    .filter(Boolean))];
  if (providerIds.length === 0) return { linked: 0, potentialOrderId: null };

  // A commercial-evidence row is a safe anchor proving at least one fragment in
  // this stitched packet already crossed the governed commercial-risk boundary.
  const { data: anchors, error: anchorError } = await admin
    .from("whatsapp_commercial_evidence")
    .select("potential_order_id")
    .in("provider_message_id", providerIds)
    .order("captured_at", { ascending: true })
    .limit(1);
  if (anchorError) throw new Error(`Commercial anchor lookup failed: ${anchorError.message}`);
  const anchorPotentialId = String(anchors?.[0]?.potential_order_id ?? "").trim();
  if (!anchorPotentialId) return { linked: 0, potentialOrderId: null };

  const { data: sources, error: sourceError } = await admin
    .from("whatsapp_inbound_messages")
    .select("id, provider_message_id, message_type")
    .in("provider_message_id", providerIds)
    .order("received_at", { ascending: true });
  if (sourceError) throw new Error(`Core source lookup failed: ${sourceError.message}`);

  let linked = 0;
  let potentialOrderId = anchorPotentialId;
  for (const source of (sources ?? []) as SourceMessage[]) {
    const { data: potential, error: potentialError } = await admin.rpc("capture_whatsapp_potential_order", {
      p_source_message_id: source.id,
      p_order_like: true,
      p_interpretation_failed: false,
      p_evidence: {
        packet_context_backfill: true,
        message_packet_id: packetId,
        authority: "stitcher_packet_complete",
      },
    });
    if (potentialError || !potential?.id) {
      throw new Error(`Packet potential lineage failed: ${potentialError?.message ?? "missing potential order"}`);
    }
    potentialOrderId = String(potential.id);

    const messageType = String(source.message_type ?? "text").toLowerCase();
    const { error: evidenceError } = await admin.rpc("capture_whatsapp_commercial_fragment_for_potential", {
      p_potential_order_id: potentialOrderId,
      p_source_message_id: source.id,
      p_media_count: messageType === "text" ? 0 : 1,
      // Media is evidence awaiting the AI worker, not an interpretation failure.
      p_interpretation_failed: false,
      p_evidence: {
        packet_context_backfill: true,
        message_packet_id: packetId,
        authority: "stitcher_packet_complete",
      },
    });
    if (evidenceError) throw new Error(`Packet commercial evidence failed: ${evidenceError.message}`);
    linked += 1;
  }

  return { linked, potentialOrderId };
}

async function invokePacketAiWorker(
  supabaseUrl: string,
  serviceKey: string,
  packetId: string,
): Promise<{ packetId: string; ok: boolean; status: number; error?: string }> {
  try {
    const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/functions/v1/whatsapp-packet-ai-worker`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ packet_id: packetId }),
      signal: AbortSignal.timeout(70_000),
    });
    const body = await response.json().catch(() => ({})) as Record<string, unknown>;
    return {
      packetId,
      ok: response.ok && body.success === true,
      status: response.status,
      ...(response.ok && body.success === true ? {} : { error: String(body.error ?? `HTTP_${response.status}`) }),
    };
  } catch (error) {
    return { packetId, ok: false, status: 0, error: error instanceof Error ? error.message : "AI_WORKER_FAILED" };
  }
}

async function runAiWorkersBounded(
  supabaseUrl: string,
  serviceKey: string,
  packetIds: string[],
): Promise<Array<{ packetId: string; ok: boolean; status: number; error?: string }>> {
  const results: Array<{ packetId: string; ok: boolean; status: number; error?: string }> = [];
  let cursor = 0;
  const workers = Array.from({ length: Math.min(AI_WORKER_CONCURRENCY, packetIds.length) }, async () => {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= packetIds.length) return;
      results[index] = await invokePacketAiWorker(supabaseUrl, serviceKey, packetIds[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ success: false, error: "Service configuration unavailable" }), { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  if ((req.headers.get("Authorization") ?? "") !== `Bearer ${serviceKey}`) {
    return new Response(JSON.stringify({ success: false, error: "Trusted stitcher caller required" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const body = await req.json().catch(() => ({})) as { windowSeconds?: number; batchSize?: number };
    const windowSeconds = Math.min(3600, Math.max(30, Number(body.windowSeconds) || DEFAULT_WINDOW_SECONDS));
    const batchSize = Math.min(500, Math.max(1, Number(body.batchSize) || DEFAULT_BATCH_SIZE));
    const admin = createClient(supabaseUrl, serviceKey);

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
    let commercialFragmentsLinked = 0;
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
        const id = String(packetId);
        if (!packetIds.includes(id)) packetIds.push(id);
        groupsProcessed += 1;
        fragmentsLinked += group.messages.length;

        const commercialSync = await syncCommercialEvidenceForPacket(admin, id);
        commercialFragmentsLinked += commercialSync.linked;
      }
    }

    const aiResults = await runAiWorkersBounded(supabaseUrl, serviceKey, packetIds);
    const aiFailures = aiResults.filter((result) => !result.ok);
    if (aiFailures.length > 0) {
      console.warn("[whatsapp-message-stitcher] packet AI failures", JSON.stringify(aiFailures));
    }

    return new Response(JSON.stringify({
      success: aiFailures.length === 0,
      ok: aiFailures.length === 0,
      messagesProcessed: unstitched.length,
      groupsProcessed,
      fragmentsLinked,
      commercialFragmentsLinked,
      packetIds,
      aiResults,
      config: { windowSeconds, batchSize, aiWorkerConcurrency: AI_WORKER_CONCURRENCY },
    }), { status: aiFailures.length === 0 ? 200 : 207, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[whatsapp-message-stitcher]", message);
    return new Response(JSON.stringify({ success: false, ok: false, error: message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
