import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get WhatsApp config
    const { data: config } = await supabaseAdmin
      .from("whatsapp_config")
      .select("*")
      .eq("is_active", true)
      .limit(1)
      .single();

    if (!config) {
      return new Response(JSON.stringify({ error: "WhatsApp not configured" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { to, message, company_id, order_id } = await req.json();

    if (!to || !message) {
      return new Response(JSON.stringify({ error: "to and message are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Clean phone number
    const cleanPhone = to.replace(/[^0-9+]/g, "");
    const fullPhone = cleanPhone.startsWith("+") ? cleanPhone : `${config.default_country_code}${cleanPhone}`;

    // Send via Click2API
    const apiRes = await fetch(`https://api.click2api.com/wa/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.api_key}`,
      },
      body: JSON.stringify({
        instance_id: config.instance_id,
        to: fullPhone.replace("+", ""),
        message,
      }),
    });

    const apiData = await apiRes.json();

    // Log to client_interactions timeline (actor_id = null for SYSTEM)
    if (company_id) {
      await supabaseAdmin.from("client_interactions").insert({
        company_id,
        executive_id: null, // SYSTEM actor
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
