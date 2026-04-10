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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const accessToken = Deno.env.get("CLICK2API_ACCESS_TOKEN");
    if (!accessToken) {
      console.error("CLICK2API_ACCESS_TOKEN not configured");
      return new Response(JSON.stringify({ error: "WhatsApp API token not configured" }), {
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

    // Clean phone number — ensure country code
    const cleanPhone = to.replace(/[^0-9+]/g, "");
    const fullPhone = cleanPhone.startsWith("+") ? cleanPhone : `+91${cleanPhone}`;
    // Click2API expects phone without '+' prefix
    const apiPhone = fullPhone.replace("+", "");

    // Send via Click2API production endpoint
    const apiRes = await fetch(`${BASE_URL}/api/v1/message/send-text`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        waba_id: WABA_ID,
        channel_id: CHANNEL_ID,
        to: apiPhone,
        message,
      }),
    });

    const apiData = await apiRes.json();
    console.log("Click2API response:", JSON.stringify(apiData).substring(0, 300));

    // Log to client_interactions timeline (actor_id = null for SYSTEM)
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
      console.error("Click2API error:", apiData);
      return new Response(JSON.stringify({ error: apiData?.message || "Click2API error" }), {
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
