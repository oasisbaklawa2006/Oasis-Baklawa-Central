// supabase/functions/whatsapp-operator-reply/index.ts
// TOOL 1 Phase 2: Operator reply handler
// Sends operator-written message to customer via WhatsApp (delegates to send-whatsapp).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type AdminClient = SupabaseClient;

interface ReplyPayload {
  packet_id: string;
  contact_id: string;
  phone_number: string;
  message: string;
  operator_id?: string;
}

interface SendWhatsAppSuccess {
  success: true;
  provider?: string;
  messageId?: string;
}

interface SendWhatsAppFailure {
  success?: false;
  error?: string;
  provider?: string;
  status?: number;
}

async function sendOperatorReply(
  supabaseAdmin: AdminClient,
  payload: ReplyPayload,
): Promise<{ success: boolean; message_id?: string; error?: string }> {
  try {
    if (payload.operator_id) {
      console.log("[whatsapp-operator-reply] operator_id:", payload.operator_id);
    }

    const { data: messageData, error: messageError } = await supabaseAdmin
      .from("whatsapp_messages")
      .insert({
        contact_id: payload.contact_id,
        packet_id: payload.packet_id,
        direction: "outbound",
        message_type: "text",
        content: payload.message,
        provider: "operator_reply",
        provider_message_id: null,
        status: "pending",
        message_timestamp: new Date().toISOString(),
        is_raw: false,
      })
      .select("id")
      .single();

    if (messageError || !messageData) {
      throw new Error(
        `Failed to create message record: ${messageError?.message ?? "no row"}`,
      );
    }

    const messageId = messageData.id as string;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!.replace(/\/$/, "");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const sendWhatsAppResponse = await fetch(
      `${supabaseUrl}/functions/v1/send-whatsapp`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({
          to: payload.phone_number,
          message: payload.message,
          order_id: null,
          company_id: null,
        }),
      },
    );

    let sendResult: SendWhatsAppSuccess | SendWhatsAppFailure = {};
    try {
      sendResult = (await sendWhatsAppResponse.json()) as
        | SendWhatsAppSuccess
        | SendWhatsAppFailure;
    } catch {
      sendResult = { error: "Invalid JSON from send-whatsapp" };
    }

    const ok =
      sendWhatsAppResponse.ok &&
      (sendResult as SendWhatsAppSuccess).success === true;

    if (ok) {
      const sr = sendResult as SendWhatsAppSuccess;
      const extId = sr.messageId != null ? String(sr.messageId) : null;
      const provider = sr.provider ?? "click2api";

      await supabaseAdmin
        .from("whatsapp_messages")
        .update({
          status: "delivered",
          provider_message_id: extId,
          provider,
          failure_reason: null,
        })
        .eq("id", messageId);

      return {
        success: true,
        message_id: messageId,
      };
    }

    const err =
      (sendResult as SendWhatsAppFailure).error ||
      `send-whatsapp failed (HTTP ${sendWhatsAppResponse.status})`;

    await supabaseAdmin
      .from("whatsapp_messages")
      .update({
        status: "failed",
        failure_reason: err,
      })
      .eq("id", messageId);

    return {
      success: false,
      error: err,
    };
  } catch (error) {
    console.error("[whatsapp-operator-reply] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const payload = (await req.json()) as ReplyPayload;

    if (
      !payload.packet_id ||
      !payload.contact_id ||
      !payload.phone_number ||
      !payload.message?.trim()
    ) {
      return new Response(
        JSON.stringify({
          success: false,
          error:
            "Missing required fields: packet_id, contact_id, phone_number, message",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const result = await sendOperatorReply(supabaseAdmin, {
      ...payload,
      message: payload.message.trim(),
    });

    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[whatsapp-operator-reply] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
