import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

serve(async (req) => {
  // GET = webhook verification
  if (req.method === "GET") {
    return new Response("OK", { status: 200, headers: corsHeaders });
  }
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const payload = await req.json();
    console.log("Incoming WhatsApp webhook:", JSON.stringify(payload).substring(0, 500));

    const senderPhone = payload?.from || payload?.sender || payload?.data?.from || "";
    const messageBody = payload?.message || payload?.body || payload?.data?.body || payload?.text || "";

    if (!senderPhone || !messageBody) {
      return new Response(JSON.stringify({ ok: true, skipped: "no sender or body" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find matching B2B company by phone
    const cleanPhone = senderPhone.replace(/[^0-9]/g, "").slice(-10);
    const { data: apps } = await supabaseAdmin
      .from("b2b_applications")
      .select("id, business_name, user_id, contact_phone, mobile_number")
      .or(`contact_phone.ilike.%${cleanPhone},mobile_number.ilike.%${cleanPhone}`)
      .eq("status", "approved")
      .limit(1);

    let companyId: string | null = null;
    let companyName = "Unknown";

    if (apps && apps.length > 0) {
      const app = apps[0];
      companyName = app.business_name;

      // Find company
      const { data: companies } = await supabaseAdmin
        .from("companies")
        .select("id")
        .eq("business_name", app.business_name)
        .limit(1);

      if (companies && companies.length > 0) {
        companyId = companies[0].id;
      }
    }

    // Log incoming message in CRM timeline
    if (companyId) {
      await supabaseAdmin.from("client_interactions").insert({
        company_id: companyId,
        executive_id: null,
        interaction_type: "whatsapp",
        notes: `[INCOMING] ${messageBody.substring(0, 1000)}`,
        outcome: "received",
      });
    }

    // Simple order-intent detection
    const orderKeywords = ["need", "order", "send", "want", "box", "boxes", "carton", "cartons", "kg", "pcs", "pieces"];
    const hasOrderIntent = orderKeywords.some((kw) => messageBody.toLowerCase().includes(kw));

    if (hasOrderIntent && companyId) {
      // Create draft order
      const { data: draftOrder, error: orderErr } = await supabaseAdmin
        .from("orders")
        .insert({
          company_id: companyId,
          status: "draft",
          dispatch_urgency: "standard",
        })
        .select("id")
        .single();

      if (!orderErr && draftOrder) {
        // Notify the account manager
        const { data: company } = await supabaseAdmin
          .from("companies")
          .select("account_manager_id")
          .eq("id", companyId)
          .single();

        if (company?.account_manager_id) {
          await supabaseAdmin.from("notifications").insert({
            user_id: company.account_manager_id,
            type: "whatsapp_order",
            message: `📱 New Draft Order created via WhatsApp for ${companyName}. Message: "${messageBody.substring(0, 120)}". Please verify and add items.`,
            is_read: false,
          });
        }

        // Also notify admins
        const { data: admins } = await supabaseAdmin
          .from("users")
          .select("id")
          .in("role", ["admin", "super_admin"])
          .limit(5);

        for (const admin of admins || []) {
          await supabaseAdmin.from("notifications").insert({
            user_id: admin.id,
            type: "whatsapp_order",
            message: `📱 WhatsApp Draft Order from ${companyName}: "${messageBody.substring(0, 100)}"`,
            is_read: false,
          });
        }

        // Log the draft creation in CRM
        await supabaseAdmin.from("client_interactions").insert({
          company_id: companyId,
          executive_id: null,
          interaction_type: "whatsapp",
          notes: `[SYSTEM] Draft order ${draftOrder.id.slice(0, 8)} auto-created from WhatsApp message.`,
          outcome: "draft_order_created",
        });
      }
    }

    return new Response(JSON.stringify({ ok: true, company: companyName, order_intent: hasOrderIntent }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unexpected error";
    console.error("whatsapp-webhook error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
