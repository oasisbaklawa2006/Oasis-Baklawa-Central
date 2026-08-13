import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.95.0";
import { requireInternalStaff } from "../_shared/requireInternalStaff.ts";

const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Content-Type": "application/json" };
const endpoint = "https://crm.click2api.in/api/v1/messages";
const reply = (body: Record<string, unknown>, status: number) => new Response(JSON.stringify(body), { status, headers });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers });
  if (req.method !== "POST") return reply({ success: false, error: "Method not allowed" }, 405);
  const authorization = await requireInternalStaff(req);
  if (!authorization.ok || authorization.caller.kind !== "staff") return reply({ success: false, error: authorization.ok ? "Staff session required" : authorization.error }, authorization.ok ? 403 : authorization.status);
  const authHeader = req.headers.get("Authorization");
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!authHeader || !url || !anonKey || !serviceKey) return reply({ success: false, error: "Service configuration unavailable" }, 500);
  try {
    const body = await req.json();
    if (![body.packet_id, body.contact_id, body.phone_number, body.message, body.idempotency_key].every((v) => typeof v === "string" && v.trim())) return reply({ success: false, error: "packet_id, contact_id, phone_number, message and idempotency_key are required" }, 400);
    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } });
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    const queued = await userClient.rpc("enqueue_whatsapp_operator_reply", { p_packet_id: body.packet_id, p_contact_id: body.contact_id, p_recipient_phone: body.phone_number, p_message_body: body.message, p_idempotency_key: body.idempotency_key, p_potential_order_id: body.potential_order_id ?? null, p_clarification_task_id: body.clarification_task_id ?? null, p_message_type: body.template_name ? "TEMPLATE" : "TEXT", p_template_name: body.template_name ?? null, p_template_language: body.template_language ?? null, p_media_reference: null, p_disclosure_scope: body.disclosure_scope ?? [] });
    if (queued.error || !queued.data?.id) return reply({ success: false, error: queued.error?.message ?? "Core enqueue failed" }, 403);
    if (["ACCEPTED", "DELIVERED", "READ"].includes(queued.data.status)) return reply({ success: true, reply_id: queued.data.id, status: queued.data.status }, 200);
    if (queued.data.status === "ACCEPTANCE_UNKNOWN") return reply({ success: false, reply_id: queued.data.id, status: queued.data.status, error: "Provider acceptance is being reconciled; retry suppressed" }, 202);
    const claimed = await admin.rpc("claim_whatsapp_operator_reply", { p_worker_id: `operator-edge:${authorization.caller.userId}`, p_reply_id: queued.data.id, p_lease_seconds: 60 });
    if (claimed.error || !claimed.data?.lease_token) return reply({ success: false, reply_id: queued.data.id, error: "Reply already processing or not retryable" }, 409);
    const apiKey = Deno.env.get("CLICK2API_API_KEY");
    const token = Deno.env.get("CLICK2API_ACCESS_TOKEN");
    if (!apiKey) {
      await admin.rpc("fail_whatsapp_operator_reply", { p_reply_id: claimed.data.id, p_lease_token: claimed.data.lease_token, p_error_code: "PROVIDER_NOT_CONFIGURED", p_error_detail: "CLICK2API_API_KEY absent", p_acceptance_unknown: false });
      return reply({ success: false, reply_id: claimed.data.id, error: "WhatsApp provider unavailable" }, 503);
    }
    let providerResponse: Response;
    try {
      const providerPayload = claimed.data.message_type === "TEMPLATE"
        ? { messaging_product: "whatsapp", to: claimed.data.recipient_phone_e164.replace(/^\+/, ""), type: "template", template: { name: claimed.data.template_name, language: { code: claimed.data.template_language } } }
        : { messaging_product: "whatsapp", to: claimed.data.recipient_phone_e164.replace(/^\+/, ""), type: "text", text: { body: claimed.data.message_body } };
      providerResponse = await fetch(endpoint, { method: "POST", signal: AbortSignal.timeout(20_000), headers: { "Content-Type": "application/json", apikey: apiKey, ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(providerPayload) });
    } catch (error) {
      await admin.rpc("fail_whatsapp_operator_reply", { p_reply_id: claimed.data.id, p_lease_token: claimed.data.lease_token, p_error_code: "NETWORK_TIMEOUT", p_error_detail: error instanceof Error ? error.message : String(error), p_acceptance_unknown: true });
      return reply({ success: false, reply_id: claimed.data.id, status: "ACCEPTANCE_UNKNOWN", error: "Provider acceptance unknown; duplicate retry suppressed" }, 202);
    }
    const providerBody = await providerResponse.json().catch(() => ({}));
    const providerId = providerBody.message_id ?? providerBody.id;
    if (providerResponse.ok && providerId) {
      const completed = await admin.rpc("complete_whatsapp_operator_reply", { p_reply_id: claimed.data.id, p_lease_token: claimed.data.lease_token, p_provider: "click2api", p_provider_message_id: String(providerId) });
      if (completed.error) return reply({ success: false, reply_id: claimed.data.id, error: "Provider accepted; local reconciliation pending" }, 202);
      return reply({ success: true, reply_id: claimed.data.id, provider_message_id: providerId, status: "ACCEPTED" }, 200);
    }
    await admin.rpc("fail_whatsapp_operator_reply", { p_reply_id: claimed.data.id, p_lease_token: claimed.data.lease_token, p_error_code: `HTTP_${providerResponse.status}`, p_error_detail: providerBody.message ?? "Provider rejected request", p_acceptance_unknown: false });
    return reply({ success: false, reply_id: claimed.data.id, error: "Provider rejected reply" }, 502);
  } catch (error) {
    console.error("[whatsapp-operator-reply]", error instanceof Error ? error.message : "unknown error");
    return reply({ success: false, error: "Unable to process operator reply" }, 500);
  }
});
