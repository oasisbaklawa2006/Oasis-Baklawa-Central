import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { requireInternalStaff } from "../_shared/requireInternalStaff.ts";

const PORTAL_URL = Deno.env.get("B2B_PORTAL_URL") || "https://b2b.oasisbaklawa.com";
const CTA_FOOTER = `\n\nPlease login to your B2B Portal to track your 10-point artisan journey:\n${PORTAL_URL}`;
const MAX_MESSAGE_LENGTH = 4_000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const CLICK2API_SEND_ENDPOINT = "https://crm.click2api.in/api/v1/messages";
const MSG91_WHATSAPP_ENDPOINT =
  "https://control.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/";

type SendResult = {
  success: boolean;
  provider: string;
  messageId?: string;
  error?: string;
  status?: number;
};

type SendPayload = {
  to?: unknown;
  message?: unknown;
  company_id?: unknown;
  order_id?: unknown;
};

function json(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizePhone(value: string): string | null {
  const digits = value.replace(/[^0-9]/g, "");
  const normalized = digits.length === 10 ? `91${digits}` : digits;
  return normalized.length >= 10 && normalized.length <= 15 ? normalized : null;
}

async function sendViaClick2API(phone: string, fullMessage: string): Promise<SendResult> {
  try {
    const apiKey = Deno.env.get("CLICK2API_API_KEY");
    const accessToken = Deno.env.get("CLICK2API_ACCESS_TOKEN");
    if (!apiKey) {
      return { success: false, provider: "click2api", error: "CLICK2API_API_KEY not configured" };
    }

    const response = await fetch(CLICK2API_SEND_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: apiKey,
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: phone,
        type: "text",
        text: { body: fullMessage },
      }),
    });
    const data = await response.json().catch(() => ({}));
    return response.ok
      ? {
          success: true,
          provider: "click2api",
          messageId: data?.message_id || data?.id,
          status: response.status,
        }
      : {
          success: false,
          provider: "click2api",
          error: data?.message || `HTTP ${response.status}`,
          status: response.status,
        };
  } catch (error) {
    return {
      success: false,
      provider: "click2api",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

async function sendViaMSG91(phone: string, fullMessage: string): Promise<SendResult> {
  try {
    const authKey = Deno.env.get("MSG91_AUTH_KEY");
    const senderId = Deno.env.get("MSG91_SENDER_ID") || "OASBKL";
    if (!authKey) {
      return { success: false, provider: "msg91", error: "MSG91_AUTH_KEY not configured" };
    }

    const response = await fetch(MSG91_WHATSAPP_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", authkey: authKey },
      body: JSON.stringify({
        integrated_number: senderId,
        content_type: "text",
        payload: { to: phone, type: "text", text: { body: fullMessage } },
      }),
    });
    const data = await response.json().catch(() => ({}));
    return response.ok
      ? {
          success: true,
          provider: "msg91",
          messageId: data?.request_id || data?.id,
          status: response.status,
        }
      : {
          success: false,
          provider: "msg91",
          error: data?.message || `HTTP ${response.status}`,
          status: response.status,
        };
  } catch (error) {
    return {
      success: false,
      provider: "msg91",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

async function sendWithFallback(phone: string, message: string): Promise<SendResult> {
  const fullMessage = message + CTA_FOOTER;
  let lastError: SendResult = {
    success: false,
    provider: "unknown",
    error: "All providers failed",
  };

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const result = await sendViaClick2API(phone, fullMessage);
    if (result.success) return result;
    lastError = result;
    if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 1_000));
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const result = await sendViaMSG91(phone, fullMessage);
    if (result.success) return result;
    lastError = result;
    if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 1_000));
  }

  return lastError;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authorization = await requireInternalStaff(req);
  if (!authorization.ok) {
    return json({ error: authorization.error }, authorization.status);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: "Supabase service is not configured" }, 500);
  }

  try {
    const payload = (await req.json()) as SendPayload;
    if (typeof payload.to !== "string" || typeof payload.message !== "string") {
      return json({ error: "to and message are required" }, 400);
    }

    const message = payload.message.trim();
    const apiPhone = normalizePhone(payload.to);
    if (!apiPhone || !message || message.length > MAX_MESSAGE_LENGTH) {
      return json({ error: "Invalid phone number or message" }, 400);
    }

    const companyId = typeof payload.company_id === "string" ? payload.company_id : null;
    const orderId = typeof payload.order_id === "string" ? payload.order_id : null;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const result = await sendWithFallback(apiPhone, message);
    await supabaseAdmin.from("debug_webhooks").insert({
      direction: "outbound",
      raw_payload: {
        provider: result.provider,
        success: result.success,
        messageId: result.messageId,
        error: result.error,
        phone: apiPhone,
        caller_kind: authorization.caller.kind,
        caller_user_id: authorization.caller.userId,
      },
      phone_number: apiPhone,
      error_message: result.success ? null : result.error,
      processed: result.success,
    });

    if (!result.success) {
      await supabaseAdmin.from("audit_logs").insert({
        action_type: "whatsapp_api_error",
        module_name: "whatsapp",
        entity_name: "send-whatsapp",
        entity_id: orderId,
        risk_level: "high",
        reason: `${result.provider} failed: ${result.error}`,
        new_value: {
          to: apiPhone,
          provider: result.provider,
          status: result.status,
          error: result.error,
          caller_user_id: authorization.caller.userId,
        },
      });
    }

    if (companyId) {
      await supabaseAdmin.from("client_interactions").insert({
        company_id: companyId,
        executive_id: authorization.caller.userId,
        interaction_type: "whatsapp",
        notes: `[AUTO] ${message.substring(0, 500)}`,
        outcome: result.success ? "delivered" : "failed",
      });
    }

    if (orderId) {
      try {
        let contact = await supabaseAdmin
          .from("whatsapp_contacts")
          .select("id")
          .eq("phone_number", apiPhone)
          .maybeSingle();
        if (!contact.data) {
          contact = await supabaseAdmin
            .from("whatsapp_contacts")
            .insert({ phone_number: apiPhone, wa_contact_id: apiPhone })
            .select("id")
            .single();
        }
        if (contact.data?.id) {
          await supabaseAdmin.from("whatsapp_messages").insert({
            contact_id: contact.data.id,
            order_id: orderId,
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
      } catch (error) {
        console.warn("[send-whatsapp] message logging failed:", error);
      }
    }

    if (!result.success) {
      return json(
        { error: result.error || "WhatsApp send failed", provider: result.provider, status: result.status },
        result.status && result.status >= 400 ? result.status : 502,
      );
    }

    return json(
      { success: true, provider: result.provider, messageId: result.messageId },
      200,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    console.error("[send-whatsapp] fatal error:", message);
    return json({ error: "Unable to send WhatsApp message" }, 500);
  }
});
