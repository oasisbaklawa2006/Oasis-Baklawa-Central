import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const ALLOWED_ORIGIN = "https://b2b.oasisbaklawa.com";
const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  Vary: "Origin",
};

const jsonResponse = (body: Record<string, unknown>, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const normalizeRole = (role: string | null | undefined) => role?.trim().toUpperCase() ?? "";

const isAdminRole = (role: string | null | undefined) => {
  const normalized = normalizeRole(role);
  return normalized === "ADMIN" || normalized === "SUPER_ADMIN";
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return jsonResponse({ error: "Supabase secrets not configured" }, 500);
    }

    if (!resendApiKey) {
      return jsonResponse({ error: "RESEND_API_KEY not configured" }, 500);
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const apikeyHeader = req.headers.get("apikey") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    const usingServiceRole = !!serviceRoleKey && (token === serviceRoleKey || apikeyHeader === serviceRoleKey);

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    if (!usingServiceRole) {
      if (!token) {
        return jsonResponse({ error: "Unauthorized" }, 401);
      }

      const supabaseAuth = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });

      const { data: userData, error: userError } = await supabaseAuth.auth.getUser(token);
      if (userError || !userData?.user) {
        return jsonResponse({ error: "Unauthorized" }, 401);
      }

      const userId = userData.user.id;
      const [{ data: isStaff, error: staffError }, { data: profile, error: profileError }] = await Promise.all([
        supabaseAdmin.rpc("is_internal_staff", { _user_id: userId }),
        supabaseAdmin.from("profiles").select("role").eq("id", userId).maybeSingle(),
      ]);

      if (staffError) {
        console.error("Staff lookup failed:", staffError);
      }
      if (profileError) {
        console.error("Profile lookup failed:", profileError);
      }

      if (!isStaff && !isAdminRole(profile?.role)) {
        return jsonResponse({ error: "Forbidden" }, 403);
      }
    }

    const { to, subject, html, text, outboxId } = await req.json();

    if (!to || typeof to !== "string" || !to.includes("@")) {
      return jsonResponse({ error: "Invalid email address" }, 400);
    }

    if (!subject || typeof subject !== "string") {
      return jsonResponse({ error: "Subject is required" }, 400);
    }

    if (!html && !text) {
      return jsonResponse({ error: "html or text body required" }, 400);
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: "Oasis Baklawa <team@oasisbaklawa.com>",
        to,
        subject,
        ...(html ? { html } : { text }),
      }),
    });

    const responseData = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error("Resend API error:", responseData);

      if (outboxId) {
        try {
          await supabaseAdmin.from("notification_outbox").update({
            status: "failed",
            error_log: responseData?.message || "Resend API error",
          }).eq("id", outboxId);
        } catch (e) {
          console.error("Failed to update outbox status:", e);
        }
      }

      return jsonResponse({ error: responseData?.message || "Failed to send email" }, response.status);
    }

    if (outboxId) {
      try {
        await supabaseAdmin.from("notification_outbox").update({
          status: "sent",
          sent_at: new Date().toISOString(),
        }).eq("id", outboxId);
        console.log(`Outbox ${outboxId} marked as sent`);
      } catch (e) {
        console.error("Failed to update outbox status:", e);
      }
    }

    return jsonResponse({ success: true, id: responseData?.id }, 200);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unexpected error";
    console.error("send-email error:", message);
    return jsonResponse({ error: message }, 500);
  }
});
