// MSG91 Delivery Webhook
// ----------------------
// Receives "On Delivered" / status callback events from MSG91 and logs them
// into `public.auth_logs` for War Room login-success analytics.
//
// Public endpoint — verify_jwt = false. MSG91 does not send a JWT; we accept
// any POST and persist the raw payload + extracted summary fields.
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabaseAdmin = SUPABASE_URL && SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  : null;

function pick(obj: any, keys: string[]): string | null {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && String(v).length > 0) return String(v);
  }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let payload: any = {};
  try {
    payload = await req.json();
  } catch {
    try { payload = { raw: await req.text() }; } catch { payload = {}; }
  }

  // MSG91 wraps events in either a flat object or { data: [...] } array.
  const events: any[] = Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(payload)
      ? payload
      : [payload];

  const rows = events.map((ev: any) => {
    const status = pick(ev, ["status", "delivery_status", "state"]);
    const event_name = pick(ev, ["event", "event_name", "eventName", "type"]) || "delivery";
    const failure_reason = pick(ev, ["failure_reason", "failureReason", "err", "error", "errorMessage", "reason", "description"]);
    return {
      event_type: event_name,
      event_name,
      phone: pick(ev, ["telNum", "mobile", "phone", "to", "number"]),
      channel: pick(ev, ["channel", "route", "service"]),
      status,
      failure_reason,
      request_id: pick(ev, ["requestId", "request_id", "id", "messageId"]),
      description: pick(ev, ["description", "message", "reason"]),
      raw_payload: ev ?? {},
    };
  });

  if (!supabaseAdmin) {
    console.error("[msg91-webhook] service role unavailable — cannot persist", rows.length, "events");
    return new Response(JSON.stringify({ ok: false, error: "service_role_unavailable" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { error } = await supabaseAdmin.from("auth_logs").insert(rows);
    if (error) {
      console.error("[msg91-webhook] insert failed:", error.message);
      return new Response(JSON.stringify({ ok: false, error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Real-time War Room 'Low Confidence' alert: status === "2" is MSG91's
    // numeric failure code; also catch textual failure variants.
    const failures = rows.filter(
      (r) => r.status === "2" || (typeof r.status === "string" && /fail|undeliv|reject|error/i.test(r.status)),
    );
    if (failures.length > 0) {
      try {
        const { data: admins } = await supabaseAdmin
          .from("users")
          .select("id")
          .in("role", ["ADMIN", "SUPER_ADMIN", "admin", "super_admin"])
          .limit(20);
        const adminIds = (admins || []).map((a: any) => a.id);
        if (adminIds.length > 0) {
          const notifs = failures.flatMap((f) =>
            adminIds.map((uid) => ({
              user_id: uid,
              type: "auth_failure",
              message: `⚠️ Login failure (MSG91): ${f.phone || "unknown phone"} via ${f.channel || "?"} — ${f.description || f.status}`,
              is_read: false,
            })),
          );
          await supabaseAdmin.from("notifications").insert(notifs);
        }
      } catch (notifyErr) {
        console.warn("[msg91-webhook] admin notification soft-failed:", notifyErr);
      }
    }

    console.log(`[msg91-webhook] logged ${rows.length} delivery event(s), ${failures.length} failure(s)`);
    return new Response(JSON.stringify({ ok: true, logged: rows.length, failures: failures.length }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[msg91-webhook] fatal:", e);
    return new Response(
      JSON.stringify({ ok: false, error: e instanceof Error ? e.message : "unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
