// supabase/functions/send-whatsapp/index.ts
// Enhanced: Click2API primary + MSG91 fallback with provider abstraction

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const PORTAL_URL = Deno.env.get("B2B_PORTAL_URL") || "https://b2b.oasisbaklawa.com";
const CTA_FOOTER = `\n\nPlease login to your B2B Portal to track your 10-point artisan journey:\n${PORTAL_URL}`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Provider endpoints
const CLICK2API_BASE_URL = "https://crm.click2api.in";
const CLICK2API_SEND_ENDPOINT = `${CLICK2API_BASE_URL}/api/v1/messages`;
const MSG91_WHATSAPP_ENDPOINT = "https://control.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/";

interface SendResult {
  success: boolean;
  provider: string;
  messageId?: string;
  error?: string;
  status?: number;
}

// Click2API Provider
async function sendViaClick2API(
  phone: string,
  message: string,
  fullMessage: string
): Promise<SendResult> {
  try {
    const apiKey = Deno.env.get("CLICK2API_API_KEY");
    const accessToken = Deno.env.get("CLICK2API_ACCESS_TOKEN");

    if (!apiKey) {
      return {
        success: false,
        provider: "click2api",
        error: "CLICK2API_API_KEY not configured",
      };
    }

    const requestBody = {
      messaging_product: "whatsapp",
      to: phone,
      type: "text",
      text: { body: fullMessage },
    };

    const apiRes = await fetch(CLICK2API_SEND_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": apiKey,
        ...(accessToken ? { "Authorization": `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(requestBody),
    });

    const apiData = await apiRes.json().catch(() => ({}));

    if (apiRes.ok) {
      return {
        success: true,
        provider: "click2api",
        messageId: apiData?.message_id || apiData?.id,
        status: apiRes.status,
      };
    } else {
      return {
        success: false,
        provider: "click2api",
        error: apiData?.message || `HTTP ${apiRes.status}`,
        status: apiRes.status,
      };
    }
  } catch (error) {
    return {
      success: false,
      provider: "click2api",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// MSG91 Fallback Provider
async function sendViaMSG91(
  phone: string,
  message: string,
  fullMessage: string
): Promise<SendResult> {
  try {
    const authKey = Deno.env.get("MSG91_AUTH_KEY");
    const senderId = Deno.env.get("MSG91_SENDER_ID") || "OASBKL";

    if (!authKey) {
      return {
        success: false,
        provider: "msg91",
        error: "MSG91_AUTH_KEY not configured",
      };
    }

    const requestBody = {
      integrated_number: senderId,
      content_type: "text",
      payload: {
        to: phone,
        type: "text",
        text: { body: fullMessage },
      },
    };

    const apiRes = await fetch(MSG91_WHATSAPP_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "authkey": authKey,
      },
      body: JSON.stringify(requestBody),
    });

    const apiData = await apiRes.json().catch(() => ({}));

    if (apiRes.ok) {
      return {
        success: true,
        provider: "msg91",
        messageId: apiData?.request_id || apiData?.id,
        status: apiRes.status,
      };
    } else {
      return {
        success: false,
        provider: "msg91",
        error: apiData?.message || `HTTP ${apiRes.status}`,
        status: apiRes.status,
      };
    }
  } catch (error) {
    return {
      success: false,
      provider: "msg91",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Send with fallback: Click2API → MSG91
async function sendWithFallback(
  phone: string,
  message: string,
  maxRetries: number = 2
): Promise<SendResult> {
  const fullMessage = message + CTA_FOOTER;
  let lastError: SendResult | null = null;

  // Try Click2API (primary)
  for (let i = 0; i < maxRetries; i++) {
    const result = await sendViaClick2API(phone, message, fullMessage);
    if (result.success) {
      console.log(`[Click2API] Success for ${phone}: ${result.messageId}`);
      return result;
    }
    lastError = result;
    console.warn(
      `[Click2API attempt ${i + 1}/${maxRetries}] Failed: ${result.error}`
    );
    if (i < maxRetries - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
    }
  }

  console.warn(`[Click2API failed, trying MSG91 fallback]`);

  // Fallback to MSG91
  for (let i = 0; i < maxRetries; i++) {
    const result = await sendViaMSG91(phone, message, fullMessage);
    if (result.success) {
      console.log(`[MSG91 fallback] Success for ${phone}: ${result.messageId}`);
      return result;
    }
    lastError = result;
    console.warn(`[MSG91 attempt ${i + 1}/${maxRetries}] Failed: ${result.error}`);
    if (i < maxRetries - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
    }
  }

  console.error(
    `[All providers failed] Last error: ${lastError?.error || "Unknown"}`
  );
  return (
    lastError || {
      success: false,
      provider: "unknown",
      error: "All providers failed",
    }
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { to, message, company_id, order_id } = await req.json();

    if (!to || !message) {
      return new Response(
        JSON.stringify({ error: "to and message are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Normalize phone
    const digitsOnly = to.replace(/[^0-9]/g, "");
    const apiPhone = digitsOnly.length === 10 ? `91${digitsOnly}` : digitsOnly;

    console.log(`[send-whatsapp] Sending to: ${apiPhone}`);

    // Send with fallback
    const result = await sendWithFallback(apiPhone, message);

    // Log to debug_webhooks (same as before)
    await supabaseAdmin.from("debug_webhooks").insert({
      direction: "outbound",
      raw_payload: {
        provider: result.provider,
        success: result.success,
        messageId: result.messageId,
        error: result.error,
        phone: apiPhone,
      },
      phone_number: apiPhone,
      error_message: result.success ? null : result.error,
      processed: result.success,
    });

    // Log errors to audit_logs
    if (!result.success) {
      await supabaseAdmin.from("audit_logs").insert({
        action_type: "whatsapp_api_error",
        module_name: "whatsapp",
        entity_name: "send-whatsapp",
        entity_id: order_id || null,
        risk_level: "high",
        reason: `${result.provider} failed: ${result.error}`,
        new_value: {
          to: apiPhone,
          provider: result.provider,
          status: result.status,
          error: result.error,
        },
      });
    }

    // Log to client_interactions
    if (company_id) {
      await supabaseAdmin.from("client_interactions").insert({
        company_id,
        executive_id: null,
        interaction_type: "whatsapp",
        notes: `[AUTO] ${message.substring(0, 500)}`,
        outcome: result.success ? "delivered" : "failed",
      });
    }

    // Log to whatsapp_messages for Sprint C
    if (order_id) {
      try {
        // Find or create contact
        let contact = await supabaseAdmin
          .from("whatsapp_contacts")
          .select("id")
          .eq("phone_number", apiPhone)
          .maybeSingle();

        if (!contact.data) {
          const newContact = await supabaseAdmin
            .from("whatsapp_contacts")
            .insert({
              phone_number: apiPhone,
              wa_contact_id: apiPhone,
            })
            .select("id")
            .single();
          contact = newContact;
        }

        if (contact.data?.id) {
          await supabaseAdmin.from("whatsapp_messages").insert({
            contact_id: contact.data.id,
            order_id: order_id,
            direction: "outbound",
            message_type: "text",
            content: message,
            provider: result.provider,
            provider_message_id: result.messageId || null,
            status: result.success ? "delivered" : "failed",
            retry_count: 0,
            failure_reason: result.error || null,
          });
        }
      } catch (e) {
        console.warn("[send-whatsapp] Failed to log to whatsapp_messages:", e);
      }
    }

    if (!result.success) {
      console.error(
        `[send-whatsapp] Error: ${result.provider} - ${result.error}`
      );
      return new Response(
        JSON.stringify({
          error: result.error,
          provider: result.provider,
          status: result.status,
        }),
        {
          status: result.status || 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        provider: result.provider,
        messageId: result.messageId,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unexpected error";
    console.error("[send-whatsapp] Fatal error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
