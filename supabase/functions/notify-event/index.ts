// Centralized notification dispatcher.
// Sends WhatsApp (Click2API send-text) + Email (Resend) for B2B events.
// Public function (verify_jwt = false) — internally uses service role for DB lookups.
// Supports multi-recipient resolution: buyer, sales executive, admin.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PORTAL_URL = "https://b2b.oasisbaklawa.com";
const CLICK2API_BASE = "https://crm.click2api.in";
const SEND_TEXT_ENDPOINT = `${CLICK2API_BASE}/api/v1/messages`;

type Channel = "email" | "whatsapp" | "both";
type Audience = "buyer" | "sales_exec" | "admin";

interface NotifyPayload {
  event: string;                    // e.g. "order_placed", "order_confirmed", "order_dispatched", "order_delivered", "approval_granted", "otp_backup"
  subject: string;                  // email subject + WA prefix
  message: string;                  // plain-text body
  audiences?: Audience[];           // default: ["buyer"]
  orderId?: string | null;
  companyId?: string | null;
  // direct recipient overrides (used by OTP backup, approval)
  email?: string | null;
  phone?: string | null;
}

const sendWhatsApp = async (phone: string, message: string) => {
  const apiKey = Deno.env.get("CLICK2API_API_KEY");
  const accessToken = Deno.env.get("CLICK2API_ACCESS_TOKEN");
  if (!apiKey) return { ok: false, error: "no_wa_key" };

  const digits = phone.replace(/\D/g, "");
  const apiPhone = digits.length === 10 ? `91${digits}` : digits;

  // Plain text via send-text per session-window strategy
  const body = {
    instance_id: apiKey,
    access_token: accessToken ?? "",
    number: apiPhone,
    message,
    type: "text",
  };

  try {
    const res = await fetch(SEND_TEXT_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: apiKey,
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(body),
    });
    return { ok: res.ok, status: res.status };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
};

const sendEmail = async (to: string, subject: string, text: string) => {
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) return { ok: false, error: "no_resend_key" };

  const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1a1a1a">
    <div style="border-bottom:2px solid #c9a961;padding-bottom:12px;margin-bottom:20px">
      <h2 style="margin:0;color:#1a1a1a;font-weight:600">Oasis Baklawa B2B</h2>
    </div>
    <div style="white-space:pre-wrap;line-height:1.6;font-size:14px">${text.replace(/</g, "&lt;")}</div>
    <div style="margin-top:28px;padding-top:16px;border-top:1px solid #eee;font-size:12px;color:#888">
      <a href="${PORTAL_URL}" style="color:#c9a961;text-decoration:none;font-weight:600">Open B2B Portal →</a>
      <p style="margin-top:8px">— Team Oasis Baklawa</p>
    </div>
  </div>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
      body: JSON.stringify({
        from: "Oasis Baklawa <team@oasisbaklawa.com>",
        to,
        subject,
        html,
      }),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const payload = (await req.json()) as NotifyPayload;
    const { event, subject, message, audiences = ["buyer"], orderId, companyId } = payload;

    if (!event || !subject || !message) {
      return new Response(JSON.stringify({ error: "event, subject, message required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Resolve recipients
    const recipients: { label: string; email?: string | null; phone?: string | null }[] = [];

    // Direct overrides (OTP backup, approval flow)
    if (payload.email || payload.phone) {
      recipients.push({ label: "direct", email: payload.email, phone: payload.phone });
    }

    let resolvedCompanyId = companyId ?? null;

    // Resolve from order
    if (orderId && !resolvedCompanyId) {
      const { data: order } = await supabase
        .from("orders")
        .select("company_id")
        .eq("id", orderId)
        .maybeSingle();
      resolvedCompanyId = order?.company_id ?? null;
    }

    if (resolvedCompanyId) {
      const { data: company } = await supabase
        .from("companies")
        .select("phone, account_manager_id, business_name")
        .eq("id", resolvedCompanyId)
        .maybeSingle();

      if (audiences.includes("buyer") && company) {
        // Buyer email lives on users table → look up via b2b_applications.contact_email or users.email
        const { data: app } = await supabase
          .from("b2b_applications")
          .select("contact_email, mobile_number")
          .eq("business_name", company.business_name)
          .maybeSingle();
        recipients.push({
          label: "buyer",
          email: app?.contact_email ?? null,
          phone: company.phone ?? app?.mobile_number ?? null,
        });
      }

      if (audiences.includes("sales_exec") && company.account_manager_id) {
        const { data: exec } = await supabase
          .from("users")
          .select("email, phone")
          .eq("id", company.account_manager_id)
          .maybeSingle();
        if (exec) recipients.push({ label: "sales_exec", email: exec.email, phone: (exec as any).phone });
      }
    }

    if (audiences.includes("admin")) {
      const { data: admins } = await supabase
        .from("users")
        .select("email, phone")
        .in("role", ["ADMIN", "SUPER_ADMIN"])
        .limit(5);
      (admins ?? []).forEach((a: any) =>
        recipients.push({ label: "admin", email: a.email, phone: a.phone }),
      );
    }

    // Dispatch
    const results: any[] = [];
    for (const r of recipients) {
      if (r.email) {
        const er = await sendEmail(r.email, subject, message);
        results.push({ to: r.email, channel: "email", label: r.label, ...er });
      }
      if (r.phone) {
        const wr = await sendWhatsApp(r.phone, `*${subject}*\n\n${message}\n\n${PORTAL_URL}`);
        results.push({ to: r.phone, channel: "whatsapp", label: r.label, ...wr });
      }
    }

    // Audit
    await supabase.from("audit_logs").insert({
      action_type: "notify_event",
      module_name: "notifications",
      entity_name: event,
      entity_id: orderId ?? resolvedCompanyId ?? null,
      risk_level: "low",
      reason: subject,
      new_value: { recipients: recipients.length, results: results.slice(0, 10) },
    });

    return new Response(JSON.stringify({ success: true, dispatched: results.length, results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unexpected error";
    console.error("notify-event error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
