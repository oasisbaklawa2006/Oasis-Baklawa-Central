import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BASE_URL = "https://crm.click2api.in";
const SEND_ENDPOINT = `${BASE_URL}/api/v1/messages`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const accessToken = Deno.env.get("CLICK2API_ACCESS_TOKEN");
    const apiKey = Deno.env.get("CLICK2API_API_KEY");
    if (!apiKey) {
      console.error("CLICK2API_API_KEY not configured");
      return new Response(JSON.stringify({ error: "WhatsApp API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { to, message, company_id, order_id } = await req.json();

    if (!to || !message) {
      return new Response(JSON.stringify({ error: "to and message are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Clean phone number — strip everything except digits
    const digitsOnly = to.replace(/[^0-9]/g, "");
    // Ensure we have country code: if 10 digits, prepend 91
    const apiPhone = digitsOnly.length === 10 ? `91${digitsOnly}` : digitsOnly;

    console.log(`Sending WhatsApp to: ${apiPhone} via ${SEND_ENDPOINT}`);

    // Append CTA footer to all outgoing messages
    const fullMessage = message + CTA_FOOTER;

    const requestBody = {
      messaging_product: "whatsapp",
      to: apiPhone,
      type: "text",
      text: { body: fullMessage },
    };

    const apiRes = await fetch(SEND_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": apiKey,
        ...(accessToken ? { "Authorization": `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(requestBody),
    });

    const responseText = await apiRes.text();
    let apiData: any;
    try {
      apiData = JSON.parse(responseText);
    } catch {
      apiData = { raw: responseText.substring(0, 500) };
    }

    console.log(`Click2API response (${apiRes.status}):`, JSON.stringify(apiData).substring(0, 500));

    // Log to debug_webhooks
    await supabaseAdmin.from("debug_webhooks").insert({
      direction: "outbound",
      raw_payload: { endpoint: SEND_ENDPOINT, request: requestBody, response: apiData, status: apiRes.status, phone: apiPhone },
      phone_number: apiPhone,
      error_message: apiRes.ok ? null : `HTTP ${apiRes.status}: ${apiData?.message || JSON.stringify(apiData)}`,
      processed: apiRes.ok,
    });

    // Log errors to audit_logs
    if (!apiRes.ok) {
      await supabaseAdmin.from("audit_logs").insert({
        action_type: "whatsapp_api_error",
        module_name: "whatsapp",
        entity_name: "send-whatsapp",
        entity_id: order_id || null,
        risk_level: "high",
        reason: `Click2API ${apiRes.status}: ${apiData?.message || JSON.stringify(apiData)}`,
        new_value: { to: apiPhone, status: apiRes.status, response: apiData },
      });
    }

    // Log to client_interactions timeline
    if (company_id) {
      await supabaseAdmin.from("client_interactions").insert({
        company_id,
        executive_id: null,
        interaction_type: "whatsapp",
        notes: `[AUTO] ${message.substring(0, 500)}`,
        outcome: apiRes.ok ? "delivered" : "failed",
      });
    }

    if (!apiRes.ok) {
      console.error("Click2API error:", JSON.stringify(apiData));
      return new Response(JSON.stringify({ error: apiData?.message || "Click2API error", status: apiRes.status, details: apiData }), {
        status: apiRes.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, data: apiData }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unexpected error";
    console.error("send-whatsapp error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
