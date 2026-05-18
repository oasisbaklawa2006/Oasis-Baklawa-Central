// supabase/functions/whatsapp-operator-reply/index.ts
// TOOL 1 Phase 2: Operator reply handler
// Sends operator-written message to customer via WhatsApp

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ReplyPayload {
  packet_id: string;
  contact_id: string;
  phone_number: string;
  message: string;
  operator_id?: string;
}

async function sendOperatorReply(
  supabaseAdmin: ReturnType<typeof createClient>,
  payload: ReplyPayload,
): Promise<{ success: boolean; message_id?: string; error?: string }> {
  try {
    const { data: messageData, error: messageError } = await supabaseAdmin
      .from("whatsapp_messages")
      .insert({
        contact_id: payload.contact_id,
        packet_id: payload.packet_id,
        direction: "outbound",
        message_type: "text",
        content: payload.message,
        provider: "whatsapp",
        provider_message_id: null,
        status: "pending",
        message_timestamp: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (messageError || !messageData) {
      throw new Error(
        `Failed to create message record: ${messageError?.message ?? "no row"}`,
      );
    }

    const messageId = messageData.id as string;
    const baseUrl = Deno.env.get("SUPABASE_URL")!.replace(/\/$/, "");

    const sendWhatsAppResponse = await fetch(
      `${baseUrl}/functions/v1/send-whatsapp`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({
          to: payload.phone_number,
          message: payload.message,
          order_id: null,
          company_id: null,
        }),
      },
    );

    let sendResult: { success?: boolean; messageId?: string; error?: string } = {};
    try {
      sendResult = await sendWhatsAppResponse.json();
    } catch {
      sendResult = {};
    }

    const sendOk =
      sendWhatsAppResponse.ok && sendResult.success === true;

    if (sendOk) {
      await supabaseAdmin
        .from("whatsapp_messages")
        .update({
          status: "sent",
          provider_message_id:
            sendResult.messageId != null ? String(sendResult.messageId) : null,
        })
        .eq("id", messageId);

      return {
        success: true,
        message_id: messageId,
      };
    }

    const failReason =
      sendResult.error ||
      `Failed to send via WhatsApp (HTTP ${sendWhatsAppResponse.status})`;

    await supabaseAdmin
      .from("whatsapp_messages")
      .update({
        status: "failed",
        failure_reason: failReason,
      })
      .eq("id", messageId);

    return {
      success: false,
      error: failReason,
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
    const payload: ReplyPayload = await req.json();

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
