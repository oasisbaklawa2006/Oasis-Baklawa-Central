// supabase/functions/send-whatsapp-automation/index.ts
// Trigger WhatsApp notifications for order lifecycle events

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface AutomationPayload {
  orderId: string;
  triggerType:
    | "so_created"
    | "payment_verified"
    | "production_started"
    | "order_dispatched";
}

const SEND_WHATSAPP_FUNCTION_URL =
  Deno.env.get("SEND_WHATSAPP_FUNCTION_URL") ||
  "http://localhost:54321/functions/v1/send-whatsapp";

async function sendWhatsAppViaFunction(
  phone: string,
  message: string,
  orderId: string,
  companyId?: string
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  try {
    const response = await fetch(SEND_WHATSAPP_FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({
        to: phone,
        message,
        order_id: orderId,
        company_id: companyId || null,
      }),
    });

    const data = await response.json();
    return {
      success: response.ok,
      messageId: data?.messageId,
      error: data?.error,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

async function handleSOCreated(
  supabaseAdmin: any,
  orderId: string
): Promise<void> {
  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("order_number, customer_phone, total_value, advance_amount, company_id")
    .eq("id", orderId)
    .single();

  if (!order?.customer_phone) return;

  const message = `Hi! Your order SO-${order.order_number} has been created.
Amount: ₹${order.total_value}
Advance due: ₹${order.advance_amount}

Reply CONFIRM to proceed with payment.`;

  const result = await sendWhatsAppViaFunction(
    order.customer_phone,
    message,
    orderId,
    order.company_id
  );

  await supabaseAdmin.from("whatsapp_automations").insert({
    contact_id: null,
    order_id: orderId,
    trigger_type: "so_created",
    message_template: "so_confirmation",
    provider: "pending",
    status: result.success ? "sent" : "failed",
    failure_reason: result.error || null,
    sent_at: result.success ? new Date().toISOString() : null,
  });
}

async function handlePaymentVerified(
  supabaseAdmin: any,
  orderId: string
): Promise<void> {
  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("order_number, customer_phone, company_id")
    .eq("id", orderId)
    .single();

  if (!order?.customer_phone) return;

  const message = `✓ Payment verified for SO-${order.order_number}
Your order is now in production. We'll update you soon!`;

  const result = await sendWhatsAppViaFunction(
    order.customer_phone,
    message,
    orderId,
    order.company_id
  );

  await supabaseAdmin.from("whatsapp_automations").insert({
    contact_id: null,
    order_id: orderId,
    trigger_type: "payment_verified",
    message_template: "payment_confirmed",
    provider: "pending",
    status: result.success ? "sent" : "failed",
    failure_reason: result.error || null,
    sent_at: result.success ? new Date().toISOString() : null,
  });
}

async function handleProductionStarted(
  supabaseAdmin: any,
  orderId: string
): Promise<void> {
  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("order_number, customer_phone, company_id")
    .eq("id", orderId)
    .single();

  if (!order?.customer_phone) return;

  const message = `🏭 Production started for SO-${order.order_number}
Expected completion in 2-3 days. We'll keep you updated!`;

  const result = await sendWhatsAppViaFunction(
    order.customer_phone,
    message,
    orderId,
    order.company_id
  );

  await supabaseAdmin.from("whatsapp_automations").insert({
    contact_id: null,
    order_id: orderId,
    trigger_type: "production_started",
    message_template: "production_alert",
    provider: "pending",
    status: result.success ? "sent" : "failed",
    failure_reason: result.error || null,
    sent_at: result.success ? new Date().toISOString() : null,
  });
}

async function handleOrderDispatched(
  supabaseAdmin: any,
  orderId: string
): Promise<void> {
  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("order_number, customer_phone, company_id")
    .eq("id", orderId)
    .single();

  if (!order?.customer_phone) return;

  const message = `📦 Your order SO-${order.order_number} is on the way!
Track updates on our app or reply here for support.`;

  const result = await sendWhatsAppViaFunction(
    order.customer_phone,
    message,
    orderId,
    order.company_id
  );

  await supabaseAdmin.from("whatsapp_automations").insert({
    contact_id: null,
    order_id: orderId,
    trigger_type: "order_dispatched",
    message_template: "dispatch_alert",
    provider: "pending",
    status: result.success ? "sent" : "failed",
    failure_reason: result.error || null,
    sent_at: result.success ? new Date().toISOString() : null,
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: AutomationPayload = await req.json();

    if (!payload.orderId || !payload.triggerType) {
      return new Response(
        JSON.stringify({
          error: "orderId and triggerType are required",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    switch (payload.triggerType) {
      case "so_created":
        await handleSOCreated(supabaseAdmin, payload.orderId);
        break;
      case "payment_verified":
        await handlePaymentVerified(supabaseAdmin, payload.orderId);
        break;
      case "production_started":
        await handleProductionStarted(supabaseAdmin, payload.orderId);
        break;
      case "order_dispatched":
        await handleOrderDispatched(supabaseAdmin, payload.orderId);
        break;
      default:
        return new Response(
          JSON.stringify({ error: "Unknown trigger type" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
    }

    return new Response(
      JSON.stringify({
        success: true,
        trigger: payload.triggerType,
        orderId: payload.orderId,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[send-whatsapp-automation] Error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
