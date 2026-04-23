// MSG91 OTP & Notification Service
// ----------------------------------
// Modes:
//   1. mode: "verify_widget"  → Server-side verifyAccessToken from MSG91 OTP Widget.
//                                Client passes the access-token returned by initSendOTP success
//                                callback; we hit MSG91 verifyAccessToken endpoint and only
//                                return ok=true if MSG91 responds with type="success".
//   2. mode: "login_otp"      → (Legacy) send a 6-digit OTP via failover ladder.
//   3. mode: "order_received" → Notify a client that their WhatsApp order was logged.
//
// FAILOVER LADDER (legacy modes): WhatsApp → SMS → Email → Voice
//
// Secrets:
//   - MSG91_AUTH_KEY   (mandatory for real sends + widget verification)
//   - MSG91_SENDER_ID  (optional; default "OASBKL")
//   - MSG91_VOICE_DID  (optional, voice fallback)
//   - RESEND_API_KEY   (email tier)

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Channel = "whatsapp" | "sms" | "email" | "voice";

interface RequestBody {
  mode: "verify_widget" | "login_otp" | "order_received";
  /** verify_widget: the access-token returned by MSG91 widget success callback. */
  accessToken?: string;
  phone?: string;
  email?: string | null;
  message?: string;
  otp?: string;
  skip?: Channel[];
}

// Unified MSG91 auth key (matches client widget tokenAuth: 509994AgMgjQib69e9dc60P1).
// Falls back to placeholder so the function still boots if secret unset.
const AUTH_KEY = Deno.env.get("MSG91_AUTH_KEY") || "509994AgMgjQib69e9dc60P1";
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

// ---- MSG91 Widget server-side verification --------------------------------
// Docs: POST https://api.msg91.com/api/v5/widget/verifyAccessToken
//   Headers: Content-Type: application/json, Accept: application/json
//   Body:    { authkey, "access-token" }
//   Success: { type: "success", message: "...", ... }
async function verifyAccessToken(accessToken: string): Promise<{ ok: boolean; raw: any }> {
  try {
    const res = await fetch("https://control.msg91.com/api/v5/widget/verifyAccessToken", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ authkey: AUTH_KEY, "access-token": accessToken }),
    });
    const raw = await res.json().catch(() => ({}));
    const ok = res.ok && (raw?.type === "success");
    return { ok, raw };
  } catch (e) {
    console.error("[msg91] verifyAccessToken failed:", e);
    return { ok: false, raw: { error: e instanceof Error ? e.message : "unknown" } };
  }
}

// ---- Channel implementations (legacy ladder) ------------------------------

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
  } catch (e) { console.error("[msg91] whatsapp failed:", e); return false; }
}

async function sendSMS(phone: string, body: string): Promise<boolean> {
  if (!MSG91_ENABLED) return false;
  try {
    const res = await fetch("https://control.msg91.com/api/v5/flow/", {
      method: "POST",
      headers: { "Content-Type": "application/json", authkey: AUTH_KEY },
      body: JSON.stringify({ sender: SENDER_ID, short_url: "0", mobiles: to91(phone), body }),
    });
    return res.ok;
  } catch (e) { console.error("[msg91] sms failed:", e); return false; }
}

async function sendEmail(email: string, subject: string, body: string): Promise<boolean> {
  if (!RESEND_KEY || !email) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_KEY}` },
      body: JSON.stringify({
        from: "Oasis Baklawa <noreply@oasisbaklawa.com>",
        to: [email], subject, text: body,
      }),
    });
    return res.ok;
  } catch (e) { console.error("[msg91] email failed:", e); return false; }
}

async function sendVoice(phone: string, body: string): Promise<boolean> {
  if (!MSG91_ENABLED || !VOICE_DID) return false;
  try {
    const res = await fetch("https://control.msg91.com/api/v5/voice/outbound", {
      method: "POST",
      headers: { "Content-Type": "application/json", authkey: AUTH_KEY },
      body: JSON.stringify({ from: VOICE_DID, to: to91(phone), text: body, voice: "female-en-IN" }),
    });
    return res.ok;
  } catch (e) { console.error("[msg91] voice failed:", e); return false; }
}

async function deliver(
  phone: string, email: string | null | undefined, body: string, subject: string, skip: Channel[] = [],
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

// ---- HTTP handler ---------------------------------------------------------

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = (await req.json()) as RequestBody;
    if (!body?.mode) {
      return new Response(JSON.stringify({ ok: false, error: "mode is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body.mode === "verify_widget") {
      if (!body.accessToken) {
        return new Response(JSON.stringify({ ok: false, error: "accessToken required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const result = await verifyAccessToken(body.accessToken);
      return new Response(
        JSON.stringify({ ok: result.ok, type: result.raw?.type ?? null, raw: result.raw }),
        { status: result.ok ? 200 : 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (body.mode === "login_otp") {
      const otp = body.otp || genOtp();
      const phone = body.phone || "";
      if (!phone) {
        return new Response(JSON.stringify({ ok: false, error: "phone required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[msg91-otp] fatal:", e);
    return new Response(
      JSON.stringify({ ok: false, error: e instanceof Error ? e.message : "unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
