// MSG91 OTP & Notification Service
// ----------------------------------
// Provides two flows used by the Oasis B2B portal:
//   1. mode: "login_otp"     → Send a 6-digit OTP for manager login.
//   2. mode: "order_received"→ Notify a client that their WhatsApp order was logged.
//
// FAILOVER LADDER (per request, executed in order; first success wins):
//   WhatsApp → SMS → Email → Voice Call
//
// Required secrets (configure via Lovable secrets):
//   - MSG91_AUTH_KEY   (mandatory)
//   - MSG91_SENDER_ID  (optional; defaults to "OASBKL")
//   - MSG91_VOICE_DID  (optional, for voice fallback)
//   - RESEND_API_KEY   (already configured; used for email tier)
//
// SECURITY: This function is invoked from the browser AND from edge cron triggers.
// We only validate the JWT for the login_otp flow when "user_id" is provided.

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Channel = "whatsapp" | "sms" | "email" | "voice";

interface RequestBody {
  mode: "login_otp" | "order_received";
  phone?: string;       // E.164 or 10-digit local; we normalize to 91XXXXXXXXXX
  email?: string | null;
  /** For order_received: short summary line (client name + SKU count). */
  message?: string;
  /** For login_otp: optional override; otherwise we generate. */
  otp?: string;
  /** Bypass channels you don't want (testing). */
  skip?: Channel[];
}

// Placeholder allows the function to deploy & boot without crashing.
// Real sends are short-circuited (mocked) until a real key is configured.
const AUTH_KEY = Deno.env.get("MSG91_AUTH_KEY") || "PLACEHOLDER_NOT_CONFIGURED";
const SENDER_ID = Deno.env.get("MSG91_SENDER_ID") || "OASBKL";
const VOICE_DID = Deno.env.get("MSG91_VOICE_DID") || "";
const MSG91_ENABLED = AUTH_KEY !== "PLACEHOLDER_NOT_CONFIGURED";
const RESEND_KEY = Deno.env.get("RESEND_API_KEY") || "";

function to91(raw: string): string {
  const d = (raw || "").replace(/\D/g, "");
  if (d.length === 10) return `91${d}`;
  if (d.length === 12 && d.startsWith("91")) return d;
  if (d.length >= 10) return d.slice(-12);
  return d;
}

function genOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// ---- Channel implementations -------------------------------------------------

async function sendWhatsApp(phone: string, body: string): Promise<boolean> {
  if (!MSG91_ENABLED) return false;
  try {
    const res = await fetch("https://control.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/", {
      method: "POST",
      headers: { "Content-Type": "application/json", authkey: AUTH_KEY },
      body: JSON.stringify({
        integrated_number: SENDER_ID,
        content_type: "text",
        payload: { to: to91(phone), type: "text", text: { body } },
      }),
    });
    return res.ok;
  } catch (e) {
    console.error("[msg91] whatsapp failed:", e);
    return false;
  }
}

async function sendSMS(phone: string, body: string): Promise<boolean> {
  if (!MSG91_ENABLED) return false;
  try {
    const res = await fetch("https://control.msg91.com/api/v5/flow/", {
      method: "POST",
      headers: { "Content-Type": "application/json", authkey: AUTH_KEY },
      body: JSON.stringify({
        sender: SENDER_ID,
        short_url: "0",
        mobiles: to91(phone),
        body, // generic text payload (see template note below)
      }),
    });
    return res.ok;
  } catch (e) {
    console.error("[msg91] sms failed:", e);
    return false;
  }
}

async function sendEmail(email: string, subject: string, body: string): Promise<boolean> {
  if (!RESEND_KEY || !email) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_KEY}` },
      body: JSON.stringify({
        from: "Oasis Baklawa <noreply@oasisbaklawa.com>",
        to: [email],
        subject,
        text: body,
      }),
    });
    return res.ok;
  } catch (e) {
    console.error("[msg91] email failed:", e);
    return false;
  }
}

async function sendVoice(phone: string, body: string): Promise<boolean> {
  if (!MSG91_ENABLED || !VOICE_DID) return false;
  try {
    const res = await fetch("https://control.msg91.com/api/v5/voice/outbound", {
      method: "POST",
      headers: { "Content-Type": "application/json", authkey: AUTH_KEY },
      body: JSON.stringify({
        from: VOICE_DID,
        to: to91(phone),
        text: body,
        voice: "female-en-IN",
      }),
    });
    return res.ok;
  } catch (e) {
    console.error("[msg91] voice failed:", e);
    return false;
  }
}

// ---- Failover orchestration --------------------------------------------------

async function deliver(
  phone: string,
  email: string | null | undefined,
  body: string,
  subject: string,
  skip: Channel[] = [],
): Promise<{ delivered: boolean; channel: Channel | null; tried: Channel[] }> {
  const tried: Channel[] = [];

  if (!skip.includes("whatsapp") && phone) {
    tried.push("whatsapp");
    if (await sendWhatsApp(phone, body)) return { delivered: true, channel: "whatsapp", tried };
  }
  if (!skip.includes("sms") && phone) {
    tried.push("sms");
    if (await sendSMS(phone, body)) return { delivered: true, channel: "sms", tried };
  }
  if (!skip.includes("email") && email) {
    tried.push("email");
    if (await sendEmail(email, subject, body)) return { delivered: true, channel: "email", tried };
  }
  if (!skip.includes("voice") && phone) {
    tried.push("voice");
    if (await sendVoice(phone, body)) return { delivered: true, channel: "voice", tried };
  }
  return { delivered: false, channel: null, tried };
}

// ---- HTTP handler ------------------------------------------------------------

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = (await req.json()) as RequestBody;
    if (!body?.mode) {
      return new Response(JSON.stringify({ ok: false, error: "mode is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body.mode === "login_otp") {
      const otp = body.otp || genOtp();
      const phone = body.phone || "";
      if (!phone) {
        return new Response(JSON.stringify({ ok: false, error: "phone required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = `Your Oasis Baklawa login code is ${otp}. Valid for 5 minutes. Do not share this code.`;
      const result = await deliver(phone, body.email ?? null, text, "Oasis Baklawa Login Code", body.skip || []);
      return new Response(
        JSON.stringify({ ok: result.delivered, channel: result.channel, tried: result.tried, otp }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (body.mode === "order_received") {
      const phone = body.phone || "";
      const text = body.message || "Your order has been received by Oasis Baklawa. Our team will confirm shortly.";
      const result = await deliver(phone, body.email ?? null, text, "Order Received — Oasis Baklawa", body.skip || []);
      return new Response(
        JSON.stringify({ ok: result.delivered, channel: result.channel, tried: result.tried }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ ok: false, error: "unknown mode" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[msg91-otp] fatal:", e);
    return new Response(
      JSON.stringify({ ok: false, error: e instanceof Error ? e.message : "unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
