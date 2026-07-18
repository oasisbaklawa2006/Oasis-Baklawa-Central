import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.45.0";
import { requireInternalStaff } from "../_shared/requireInternalStaff.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_MESSAGE_LENGTH = 4_000;
type AdminClient = SupabaseClient;

type ReplyPayload = {
  packet_id?: unknown;
  contact_id?: unknown;
  phone_number?: unknown;
  message?: unknown;
};

type SendWhatsAppResult = {
  success?: boolean;
  provider?: string;
  messageId?: string;
  error?: string;
  status?: number;
};

function json(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sendOperatorReply(
  supabaseAdmin: AdminClient,
  payload: {
    packetId: string;
    contactId: string;
    phoneNumber: string;
    message: string;
  },
): Promise<{ success: boolean; message_id?: string; error?: string }> {
  const { data: packet, error: packetError } = await supabaseAdmin
    .from("whatsapp_message_packets")
    .select("id, contact_id")
    .eq("id", payload.packetId)
    .maybeSingle();
  if (packetError || !packet || packet.contact_id !== payload.contactId) {
    return { success: false, error: "Packet and contact do not match" };
  }

  const { data: contact, error: contactError } = await supabaseAdmin
    .from("whatsapp_contacts")
    .select("id, phone_number")
    .eq("id", payload.contactId)
    .maybeSingle();
  if (contactError || !contact || contact.phone_number !== payload.phoneNumber) {
    return { success: false, error: "Contact and phone number do not match" };
  }

  const { data: messageData, error: messageError } = await supabaseAdmin
    .from("whatsapp_messages")
    .insert({
      contact_id: payload.contactId,
      packet_id: payload.packetId,
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
    return {
      success: false,
      error: `Failed to create message record: ${messageError?.message ?? "no row"}`,
    };
  }

  const messageId = String(messageData.id);
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!.replace(/\/$/, "");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const response = await fetch(`${supabaseUrl}/functions/v1/send-whatsapp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
    },
    body: JSON.stringify({
      to: payload.phoneNumber,
      message: payload.message,
      order_id: null,
      company_id: null,
    }),
  });

  const sendResult = (await response.json().catch(() => ({
    error: "Invalid JSON from send-whatsapp",
  }))) as SendWhatsAppResult;

  if (response.ok && sendResult.success === true) {
    await supabaseAdmin
      .from("whatsapp_messages")
      .update({
        status: "delivered",
        provider_message_id: sendResult.messageId ? String(sendResult.messageId) : null,
        provider: sendResult.provider ?? "click2api",
        failure_reason: null,
      })
      .eq("id", messageId);

    return { success: true, message_id: messageId };
  }

  const error = sendResult.error || `send-whatsapp failed (HTTP ${response.status})`;
  await supabaseAdmin
    .from("whatsapp_messages")
    .update({ status: "failed", failure_reason: error })
    .eq("id", messageId);

  return { success: false, error };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authorization = await requireInternalStaff(req);
  if (!authorization.ok) {
    return json({ success: false, error: authorization.error }, authorization.status);
  }
  if (authorization.caller.kind !== "staff" || !authorization.caller.userId) {
    return json({ success: false, error: "A staff user session is required" }, 403);
  }

  try {
    const payload = (await req.json()) as ReplyPayload;
    if (
      typeof payload.packet_id !== "string" ||
      typeof payload.contact_id !== "string" ||
      typeof payload.phone_number !== "string" ||
      typeof payload.message !== "string"
    ) {
      return json(
        {
          success: false,
          error: "Missing required fields: packet_id, contact_id, phone_number, message",
        },
        400,
      );
    }

    const message = payload.message.trim();
    const phoneNumber = payload.phone_number.replace(/[^0-9]/g, "");
    if (
      !message ||
      message.length > MAX_MESSAGE_LENGTH ||
      phoneNumber.length < 10 ||
      phoneNumber.length > 15
    ) {
      return json({ success: false, error: "Invalid phone number or message" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return json({ success: false, error: "Supabase service is not configured" }, 500);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });
    const result = await sendOperatorReply(supabaseAdmin, {
      packetId: payload.packet_id,
      contactId: payload.contact_id,
      phoneNumber,
      message,
    });

    return json(result, result.success ? 200 : 400);
  } catch (error) {
    console.error("[whatsapp-operator-reply] error:", error);
    return json({ success: false, error: "Unable to send operator reply" }, 500);
  }
});
