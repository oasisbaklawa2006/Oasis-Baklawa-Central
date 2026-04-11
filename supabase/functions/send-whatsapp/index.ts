import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const WABA_ID = "2215829225584918";
const CHANNEL_ID = "68ce999be70660c0e8f3156f";
const BASE_URL = "https://crm.click2api.in";
const INSTANCE_ID = CHANNEL_ID; // Click2API uses channel as instance

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const accessToken = Deno.env.get("CLICK2API_ACCESS_TOKEN");
    const apiKey = Deno.env.get("CLICK2API_API_KEY");
    if (!accessToken) {
      console.error("CLICK2API_ACCESS_TOKEN not configured");
      return new Response(JSON.stringify({ error: "WhatsApp API token not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.log(`Access token length: ${accessToken.length}, API key present: ${!!apiKey}`);

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

    console.log(`Sending WhatsApp to: ${apiPhone} (original: ${to})`);

    // Build request bodies for different API styles
    const codechatBody = {
      recipient: { recipientType: "individual", waId: apiPhone },
      textMessage: { text: message },
    };
    const legacyBody = {
      waba_id: WABA_ID,
      channel_id: CHANNEL_ID,
      to: apiPhone,
      message,
    };
    const metaStyleBody = {
      messaging_product: "whatsapp",
      to: apiPhone,
      type: "text",
      text: { body: message },
    };

    // Try multiple endpoint patterns with different auth & body combos
    const attempts = [
      // CodeChat-style (most likely for crm.click2api.in)
      { url: `${BASE_URL}/api/v2/instance/${INSTANCE_ID}/send/text`, body: codechatBody, auth: `Bearer ${accessToken}` },
      { url: `${BASE_URL}/api/v1/instance/${INSTANCE_ID}/send/text`, body: codechatBody, auth: `Bearer ${accessToken}` },
      // With apikey header
      { url: `${BASE_URL}/api/v2/instance/${INSTANCE_ID}/send/text`, body: codechatBody, auth: apiKey || accessToken },
      // Legacy style
      { url: `${BASE_URL}/api/v1/message/send-text`, body: legacyBody, auth: `Bearer ${accessToken}` },
      // Meta Cloud API style
      { url: `${BASE_URL}/api/v1/${WABA_ID}/messages`, body: metaStyleBody, auth: `Bearer ${accessToken}` },
      // Simple paths
      { url: `${BASE_URL}/api/send-text`, body: legacyBody, auth: `Bearer ${accessToken}` },
      { url: `${BASE_URL}/message/send-text`, body: legacyBody, auth: `Bearer ${accessToken}` },
    ];

    let apiRes: Response | null = null;
    let apiData: any = null;
    let usedEndpoint = "";

    for (const attempt of attempts) {
      console.log(`Trying: ${attempt.url}`);
      try {
        apiRes = await fetch(attempt.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": attempt.auth.startsWith("Bearer ") ? attempt.auth : `Bearer ${attempt.auth}`,
            ...(apiKey ? { "apikey": apiKey } : {}),
          },
          body: JSON.stringify(attempt.body),
        });

        const responseText = await apiRes.text();
        usedEndpoint = attempt.url;

        try {
          apiData = JSON.parse(responseText);
        } catch {
          console.log(`Non-JSON from ${attempt.url}: ${responseText.substring(0, 200)}`);
          continue;
        }

        // Success or meaningful error (not 404 path error) — stop trying
        if (apiRes.ok || (apiRes.status !== 404)) {
          console.log(`Got ${apiRes.status} from ${attempt.url} — stopping discovery`);
          break;
        }
        console.log(`${attempt.url} returned ${apiRes.status}, trying next...`);
      } catch (fetchErr) {
        console.log(`Fetch error for ${attempt.url}: ${fetchErr}`);
        continue;
      }
    }

    if (!apiRes) {
      throw new Error("No API endpoints available");
    }

    console.log(`Click2API response (${apiRes.status}) from ${usedEndpoint}:`, JSON.stringify(apiData).substring(0, 500));

    // Log to debug_webhooks for outgoing visibility
    await supabaseAdmin.from("debug_webhooks").insert({
      direction: "outbound",
      raw_payload: { request: requestBody, response: apiData, status: apiRes.status },
      phone_number: apiPhone,
      error_message: apiRes.ok ? null : `HTTP ${apiRes.status}: ${apiData?.message || JSON.stringify(apiData)}`,
      processed: apiRes.ok,
    });

    // Log 401/404 errors to audit_logs
    if (apiRes.status === 401 || apiRes.status === 404) {
      await supabaseAdmin.from("audit_logs").insert({
        action_type: "whatsapp_api_error",
        module_name: "whatsapp",
        entity_name: "send-whatsapp",
        entity_id: order_id || null,
        risk_level: "high",
        reason: `Click2API ${apiRes.status} error: ${apiData?.message || "Unknown"}`,
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
