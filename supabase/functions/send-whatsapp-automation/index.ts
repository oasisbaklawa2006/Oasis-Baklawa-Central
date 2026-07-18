// supabase/functions/send-whatsapp-automation/index.ts
// Trigger WhatsApp notifications for order lifecycle events

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { requireInternalStaff } from "../_shared/requireInternalStaff.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type AutomationPayload = {
  orderId?: unknown;
  triggerType?: unknown;
};

type TriggerType =
  | "so_created"
  | "payment_verified"
  | "production_started"
  | "order_dispatched";

const ALLOWED_TRIGGERS = new Set<TriggerType>([
  "so_created",
  "payment_verified",
  "production_started",
  "order_dispatched",
]);

const SEND_WHATSAPP_FUNCTION_URL =
  Deno.env.get("SEND_WHATSAPP_FUNCTION_URL") ||
  "http://localhost:54321/functions/v1/send-whatsapp";

function json(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sendWhatsAppViaFunction(
  phone: string,
  message: string,
  orderId: string,
  companyId?: string,
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  try {
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!serviceRoleKey) {
      return { success: false, error: "Supabase service is not configured" };
    }

    const response = await fetch(SEND_WHATSAPP_FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
      },
      body: JSON.stringify({
        to: phone,
        message,
        order_id: orderId,
        company_id: companyId || null,
      }),
    });

    const data = await response.json().catch(() => ({}));
    return {
      success: response.ok && data?.success === true,
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

async function loadOrder(supabaseAdmin: any, orderId: string, fields: string) {
  const { data, error } = await supabaseAdmin
    .from("orders")
    .select(fields)
    .eq("id", orderId)
    .single();
  if (error) throw new Error(`Unable to load order: ${error.message}`);
  return data;
}

async function recordAutomation(
  supabaseAdmin: any,
  orderId: string,
  triggerType: TriggerType,
  template: string,
  result: { success: boolean; error?: string },
): Promise<void> {
  const { error } = await supabaseAdmin.from("whatsapp_automations").insert({
    contact_id: null,
    order_id: orderId,
    trigger_type: triggerType,
    message_template: template,
    provider: "pending",
    status: result.success ? "sent" : "failed",
    failure_reason: result.error || null,
    sent_at: result.success ? new Date().toISOString() : null,
  });
  if (error) throw new Error(`Unable to record WhatsApp automation: ${error.message}`);
}

async function handleSOCreated(supabaseAdmin: any, orderId: string): Promise<void> {
  const order = await loadOrder(
    supabaseAdmin,
    orderId,
    "order_number, customer_phone, total_value, advance_amount, company_id",
  );
  if (!order?.customer_phone) return;

  const message = `Hi! Your order SO-${order.order_number} has been created.
Amount: ₹${order.total_value}
Advance due: ₹${order.advance_amount}

Reply CONFIRM to proceed with payment.`;

  const result = await sendWhatsAppViaFunction(
    order.customer_phone,
    message,
    orderId,
    order.company_id,
  );
  await recordAutomation(supabaseAdmin, orderId, "so_created", "so_confirmation", result);
}

async function handlePaymentVerified(supabaseAdmin: any, orderId: string): Promise<void> {
  const order = await loadOrder(
    supabaseAdmin,
    orderId,
    "order_number, customer_phone, company_id",
  );
  if (!order?.customer_phone) return;

  const message = `✓ Payment verified for SO-${order.order_number}
Your order is now in production. We'll update you soon!`;
  const result = await sendWhatsAppViaFunction(
    order.customer_phone,
    message,
    orderId,
    order.company_id,
  );
  await recordAutomation(
    supabaseAdmin,
    orderId,
    "payment_verified",
    "payment_confirmed",
    result,
  );
}

async function handleProductionStarted(supabaseAdmin: any, orderId: string): Promise<void> {
  const order = await loadOrder(
    supabaseAdmin,
    orderId,
    "order_number, customer_phone, company_id",
  );
  if (!order?.customer_phone) return;

  const message = `🏭 Production started for SO-${order.order_number}
Expected completion in 2-3 days. We'll keep you updated!`;
  const result = await sendWhatsAppViaFunction(
    order.customer_phone,
    message,
    orderId,
    order.company_id,
  );
  await recordAutomation(
    supabaseAdmin,
    orderId,
    "production_started",
    "production_alert",
    result,
  );
}

async function handleOrderDispatched(supabaseAdmin: any, orderId: string): Promise<void> {
  const order = await loadOrder(
    supabaseAdmin,
    orderId,
    "order_number, customer_phone, company_id",
  );
  if (!order?.customer_phone) return;

  const message = `📦 Your order SO-${order.order_number} is on the way!
Track updates on our app or reply here for support.`;
  const result = await sendWhatsAppViaFunction(
    order.customer_phone,
    message,
    orderId,
    order.company_id,
  );
  await recordAutomation(
    supabaseAdmin,
    orderId,
    "order_dispatched",
    "dispatch_alert",
    result,
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authorization = await requireInternalStaff(req);
  if (!authorization.ok) {
    return json({ error: authorization.error }, authorization.status);
  }
  if (authorization.caller.kind !== "service_role") {
    return json({ error: "Service-role invocation is required" }, 403);
  }

  try {
    const payload = (await req.json()) as AutomationPayload;
    if (
      typeof payload.orderId !== "string" ||
      typeof payload.triggerType !== "string" ||
      !ALLOWED_TRIGGERS.has(payload.triggerType as TriggerType)
    ) {
      return json({ error: "Valid orderId and triggerType are required" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return json({ error: "Supabase service is not configured" }, 500);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });
    const triggerType = payload.triggerType as TriggerType;

    switch (triggerType) {
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
    }

    return json({ success: true, trigger: triggerType, orderId: payload.orderId }, 200);
  } catch (error) {
    console.error("[send-whatsapp-automation] error:", error);
    return json({ error: "Unable to process WhatsApp automation" }, 500);
  }
});
