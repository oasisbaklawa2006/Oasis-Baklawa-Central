/* eslint-disable @typescript-eslint/no-explicit-any -- Click2API/Meta webhook payloads are untrusted multi-shape provider input normalized immediately by extractPayloadFields. */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { authenticateClick2ApiWebhook, matchesWebhookToken } from "../_shared/click2apiWebhookAuth.ts";

type SupabaseAdminClient = SupabaseClient;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Content-Type": "application/json",
};

const ORDER_INTENT_KEYWORDS = [
  "need", "order", "send", "want", "box", "boxes", "carton", "cartons",
  "kg", "pcs", "pieces", "rate", "price", "quote",
];
const DEVANAGARI_COMMERCE = /(किलो|केजी|किग्रा|बॉक्स|डिब्ब|कार्टन|पीस|ऑर्डर|भेज|डालना|चाहिए|मंगवा|मंगाना)/u;
const GOVERNED_PROVIDER_STATUSES = ["ACCEPTED", "DELIVERED", "READ"] as const;

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function to91(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  return digits;
}

function extractPayloadFields(payload: any) {
  const value = payload?.entry?.[0]?.changes?.[0]?.value;
  if (value) {
    const msg = value?.messages?.[0];
    const contact = value?.contacts?.[0];
    const media = msg?.image ?? msg?.document ?? msg?.video ?? msg?.audio ?? null;
    return {
      senderPhone: msg?.from || contact?.wa_id || "",
      messageBody: msg?.text?.body || msg?.caption || media?.caption || "",
      messageType: msg?.type || "text",
      mediaUrl: media?.url || media?.link || null,
      messageId: msg?.id || null,
      profileName: contact?.profile?.name || null,
      timestampSec: msg?.timestamp ?? null,
      statuses: Array.isArray(value?.statuses) ? value.statuses : [],
    };
  }

  const m91 = payload?.payload?.message
    ? payload.payload
    : payload?.data?.payload?.message
    ? payload.data.payload
    : null;
  if (m91) {
    const message = m91.message || {};
    const media = message.media || message.image || message.document || message.video || null;
    const text = message.text?.body || message.text || message.caption || media?.caption || m91.text || "";
    return {
      senderPhone: m91.mobile || m91.from || m91.sender || m91.contact?.wa_id || "",
      messageBody: typeof text === "string" ? text : (text?.body || ""),
      messageType: message.type || m91.type || (media ? "image" : "text"),
      mediaUrl: media?.url || media?.link || media?.media_url || null,
      messageId: m91._id || m91.id || m91.message_id || message.id || null,
      profileName: m91.sender_name || m91.name || m91.contact?.profile?.name || null,
      timestampSec: m91.timestamp ?? message.timestamp ?? null,
      statuses: [],
    };
  }

  return {
    senderPhone: payload?.from || payload?.sender || payload?.mobile || payload?.data?.from || payload?.contact?.wa_id || payload?.waId || "",
    messageBody: payload?.message || payload?.body || payload?.data?.body || payload?.text?.body || payload?.text || "",
    messageType: payload?.messageType || payload?.type || payload?.data?.type || "text",
    mediaUrl: payload?.mediaUrl || payload?.media_url || payload?.data?.media_url || payload?.image?.url || payload?.document?.url || null,
    messageId: payload?.messageId || payload?.id || payload?.message_id || null,
    profileName: payload?.pushName || payload?.profileName || payload?.contact?.name || payload?.sender_name || null,
    timestampSec: payload?.timestamp ?? payload?.data?.timestamp ?? null,
    statuses: Array.isArray(payload?.statuses) ? payload.statuses : [],
  };
}

function isPotentialCommercialIntake(messageBody: string, mediaUrl: string | null): boolean {
  if (mediaUrl) return true;
  const normalized = messageBody.toLowerCase();
  return ORDER_INTENT_KEYWORDS.some((keyword) => normalized.includes(keyword)) || DEVANAGARI_COMMERCE.test(messageBody);
}

async function ensureCorePotentialCapture(
  supabaseAdmin: SupabaseAdminClient,
  input: {
    providerMessageId: string;
    senderPhone: string;
    senderName: string;
    messageBody: string;
    messageType: string;
    receivedAt: string;
    rawPayload: unknown;
    orderLike: boolean;
  },
): Promise<void> {
  const { data: sourceMessage, error: sourceError } = await supabaseAdmin
    .from("whatsapp_inbound_messages")
    .upsert({
      provider_message_id: input.providerMessageId,
      sender_phone: input.senderPhone,
      sender_name: input.senderName || null,
      message_body: input.messageBody,
      message_type: input.messageType || "text",
      received_at: input.receivedAt,
      raw_payload: {
        ...(input.rawPayload && typeof input.rawPayload === "object" ? input.rawPayload : {}),
        commercial_eligible: input.orderLike,
      },
      resolver_status: "pending",
    }, { onConflict: "provider_message_id", ignoreDuplicates: true })
    .select("id")
    .maybeSingle();
  if (sourceError) throw new Error(`WA1_CORE_SOURCE_CAPTURE_FAILED: ${sourceError.message}`);

  let sourceMessageId = sourceMessage?.id;
  if (!sourceMessageId) {
    const { data: existing, error: existingError } = await supabaseAdmin
      .from("whatsapp_inbound_messages")
      .select("id")
      .eq("provider_message_id", input.providerMessageId)
      .single();
    if (existingError || !existing?.id) {
      throw new Error(`WA1_CORE_SOURCE_LOOKUP_FAILED: ${existingError?.message ?? "missing row"}`);
    }
    sourceMessageId = existing.id;
  }

  if (!input.orderLike) return;
  const { data: potentialOrder, error: captureError } = await supabaseAdmin.rpc("capture_whatsapp_potential_order", {
    p_source_message_id: sourceMessageId,
    p_order_like: true,
    p_interpretation_failed: false,
    p_evidence: { ingress: "click2api", authentication: "verified", capture_contract: "wa1", ingress_mode: "capture_only" },
  });
  if (captureError) throw new Error(`WA1_CORE_POTENTIAL_CAPTURE_FAILED: ${captureError.message}`);
  if (!potentialOrder?.id) throw new Error("WA1_CORE_POTENTIAL_CAPTURE_FAILED: missing authority row");

  const hasMedia = input.messageType.toLowerCase() !== "text";
  const { error: evidenceError } = await supabaseAdmin.rpc("capture_whatsapp_commercial_fragment_for_potential", {
    p_potential_order_id: potentialOrder.id,
    p_source_message_id: sourceMessageId,
    p_media_count: hasMedia ? 1 : 0,
    p_interpretation_failed: hasMedia,
    p_evidence: {
      ingress: "click2api",
      authentication: "verified",
      fail_open_media_review: hasMedia,
      ingress_mode: "capture_only",
    },
  });
  if (evidenceError) throw new Error(`WA4_CORE_EVIDENCE_CAPTURE_FAILED: ${evidenceError.message}`);
}

async function reconcileProviderStatuses(
  supabaseAdmin: SupabaseAdminClient,
  statuses: any[],
): Promise<void> {
  for (const statusEvent of statuses) {
    const providerMessageId = String(statusEvent?.id ?? statusEvent?.message_id ?? "").trim();
    const providerStatus = String(statusEvent?.status ?? "").trim().toUpperCase();
    if (!providerMessageId || !GOVERNED_PROVIDER_STATUSES.includes(providerStatus as typeof GOVERNED_PROVIDER_STATUSES[number])) {
      continue;
    }
    const { error: statusError } = await supabaseAdmin.rpc("record_whatsapp_operator_reply_status", {
      p_reply_id: statusEvent?.metadata?.reply_id ?? null,
      p_provider: "click2api",
      p_provider_message_id: providerMessageId,
      p_status: providerStatus,
      p_evidence: { provider_timestamp: statusEvent?.timestamp ?? null },
    });
    if (statusError && !statusError.message.includes("WA5_STATUS_BOUNDARY_OR_REGRESSION")) {
      console.error("Governed outbound status reconciliation failed", statusError.message);
    }
  }
}

async function findOrCreateWhatsappContact(
  supabaseAdmin: SupabaseAdminClient,
  phoneDigits: string,
): Promise<string | null> {
  if (!phoneDigits) return null;
  const existing = await supabaseAdmin
    .from("whatsapp_contacts")
    .select("id")
    .eq("phone_number", phoneDigits)
    .maybeSingle();
  if (existing.data?.id) return existing.data.id;

  const created = await supabaseAdmin
    .from("whatsapp_contacts")
    .insert({ phone_number: phoneDigits, wa_contact_id: phoneDigits })
    .select("id")
    .single();
  if (created.error) {
    console.warn("[whatsapp-webhook] whatsapp_contacts insert failed", created.error.message);
    return null;
  }
  return created.data?.id ?? null;
}

function triggerMessageStitcherNonBlocking(): void {
  const baseUrl = Deno.env.get("SUPABASE_URL")?.replace(/\/$/, "");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!baseUrl || !serviceKey) return;
  void fetch(`${baseUrl}/functions/v1/whatsapp-message-stitcher`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceKey}` },
    body: JSON.stringify({ trigger: "webhook" }),
  }).catch((error) => console.warn("[whatsapp-webhook] stitcher call failed", String(error)));
}

serve(async (req) => {
  if (req.method === "GET") {
    const url = new URL(req.url);
    const entries = Array.from(url.searchParams.entries());
    const challengeNames = ["challange", "challenge", "hub.challenge", "hub_challenge"];
    const tokenNames = ["echo", "hub.verify_token", "verify_token"];
    const challenge = entries.find(([key]) => challengeNames.includes(key.toLowerCase()));
    const token = entries.find(([key]) => tokenNames.includes(key.toLowerCase()));
    if (challenge && matchesWebhookToken(token?.[1] ?? null, Deno.env.get("WHATSAPP_WEBHOOK_VERIFY_TOKEN"))) {
      return new Response(challenge[1], { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8" } });
    }
    return new Response("Webhook verification failed", { status: 403 });
  }
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  const auth = authenticateClick2ApiWebhook(
    req,
    Deno.env.get("WHATSAPP_WEBHOOK_SECRET"),
    Deno.env.get("WHATSAPP_WEBHOOK_VERIFY_TOKEN"),
  );
  if (!auth.authenticated) return json({ ok: false, error: "Unauthorized webhook" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return json({ ok: false, error: "Service configuration unavailable" }, 500);
  const admin = createClient(supabaseUrl, serviceKey);

  try {
    const payload = await req.json();
    const fields = extractPayloadFields(payload);

    if (fields.statuses.length > 0) {
      await reconcileProviderStatuses(admin, fields.statuses);
      await admin.from("debug_webhooks").insert({
        direction: "inbound",
        raw_payload: payload,
        phone_number: fields.senderPhone ? to91(fields.senderPhone) : null,
        processed: true,
        discard_reason: "provider_status_evidence",
      });
      if (!fields.messageBody && !fields.mediaUrl) {
        return json({ ok: true, captured: "provider_status_evidence" });
      }
    }

    const noiseTypes = new Set(["reaction", "unsupported", "system", "ephemeral", "sticker_reaction"]);
    const isNoise = noiseTypes.has(String(fields.messageType || "").toLowerCase());
    const isEmpty = !fields.messageBody && !fields.mediaUrl;
    if (isNoise || isEmpty) {
      await admin.from("debug_webhooks").insert({
        direction: "inbound",
        raw_payload: payload,
        phone_number: fields.senderPhone ? to91(fields.senderPhone) : null,
        wamid: fields.messageId || null,
        processed: true,
        discard_reason: isNoise ? `noise_${fields.messageType}` : "empty_body",
      });
      return json({ ok: true, discarded: isNoise ? fields.messageType : "empty" });
    }

    if (!fields.messageId) return json({ ok: false, error: "Provider message ID required" }, 400);

    const phone91 = to91(fields.senderPhone);
    const timestampMs = Number(fields.timestampSec) * 1000;
    const receivedAt = fields.timestampSec != null && Number.isFinite(timestampMs) && Math.abs(timestampMs) <= 8.64e15
      ? new Date(timestampMs).toISOString()
      : new Date().toISOString();

    await ensureCorePotentialCapture(admin, {
      providerMessageId: fields.messageId,
      senderPhone: phone91,
      senderName: fields.profileName || "",
      messageBody: fields.messageBody || "",
      messageType: fields.messageType || "text",
      receivedAt,
      rawPayload: payload,
      orderLike: isPotentialCommercialIntake(fields.messageBody || "", fields.mediaUrl),
    });

    const { data: existingWamid } = await admin
      .from("debug_webhooks")
      .select("id")
      .eq("wamid", fields.messageId)
      .limit(1)
      .maybeSingle();
    if (existingWamid?.id) {
      await admin.from("debug_webhooks").insert({
        direction: "inbound",
        raw_payload: payload,
        phone_number: phone91 || null,
        wamid: fields.messageId,
        processed: true,
        discard_reason: "duplicate_wamid",
        error_message: `Duplicate WhatsApp message ID — original webhook ${existingWamid.id}`,
      });
      return json({ ok: true, discarded: "duplicate_wamid" });
    }

    await admin.from("debug_webhooks").insert({
      direction: "inbound",
      raw_payload: payload,
      phone_number: phone91 || null,
      wamid: fields.messageId,
      processed: true,
      message_intent: isPotentialCommercialIntake(fields.messageBody || "", fields.mediaUrl) ? "POTENTIAL_COMMERCIAL" : "OTHER",
    });

    const contactId = await findOrCreateWhatsappContact(admin, phone91);
    if (contactId) {
      const tsSec = fields.timestampSec != null && fields.timestampSec !== "" ? Number(fields.timestampSec) : NaN;
      const messageTimestamp = Number.isFinite(tsSec) && tsSec > 0 ? new Date(tsSec * 1000) : new Date();
      const { error: messageError } = await admin.from("whatsapp_messages").insert({
        contact_id: contactId,
        order_id: null,
        direction: "inbound",
        message_type: fields.messageType || "text",
        content: fields.messageBody || "",
        media_url: fields.mediaUrl || null,
        provider: "whatsapp",
        provider_message_id: fields.messageId,
        status: "received",
        message_timestamp: messageTimestamp,
        is_raw: true,
        packet_id: null,
      });
      if (!messageError) triggerMessageStitcherNonBlocking();
      else if (!String(messageError.message).toLowerCase().includes("duplicate")) {
        console.warn("[whatsapp-webhook] whatsapp_messages insert failed", messageError.message);
      }
    }

    return json({
      ok: true,
      capture_only: true,
      provider_message_id: fields.messageId,
      commercial_eligible: isPotentialCommercialIntake(fields.messageBody || "", fields.mediaUrl),
      outbound_sent: false,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unexpected error";
    console.error("[whatsapp-webhook] capture failed", detail);
    return json({ ok: false, error: "Durable intake unavailable" }, 503);
  }
});