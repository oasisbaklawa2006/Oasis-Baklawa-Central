// Secure B2B User Validation Gateway for the MSG91 OTP Widget.
//
// Contract (per MSG91 spec):
//   - Always returns HTTP 200
//   - JSON body: { "user_found": true|false, "identifier": "..." }
//   - Accepts GET (?identifier=...) and POST ({ identifier|mobile|email })
//   - CORS open (widget calls from MSG91 / browser origins)
//
// Database performance — run once if not already present:
//   CREATE INDEX IF NOT EXISTS idx_users_phone ON public.users (phone);
//   CREATE INDEX IF NOT EXISTS idx_users_email ON public.users (email);
//
// Uses SUPABASE_SERVICE_ROLE_KEY to bypass JWT/RLS because the widget
// invokes this endpoint externally without a user session.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const ok = (body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const digitsOnly = (v: string) => v.replace(/\D+/g, "");
const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

serve(async (req) => {
  // 1. CORS preflight — return 200 immediately.
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  // 2. Extract identifier from query (GET) or JSON body (POST).
  let identifier = "";
  try {
    if (req.method === "GET") {
      identifier = new URL(req.url).searchParams.get("identifier") ?? "";
    } else {
      const body = await req.json().catch(() => ({} as Record<string, unknown>));
      identifier = String(
        body?.identifier ?? body?.mobile ?? body?.email ?? "",
      );
    }
  } catch (_) {
    identifier = "";
  }

  identifier = identifier.trim();
  if (!identifier) return ok({ user_found: false, identifier: "" });

  try {
    // 3. Service-role client — bypasses RLS for the lookup.
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    let found = false;

    if (isEmail(identifier)) {
      const email = identifier.toLowerCase();

      const { data: u } = await supabase
        .from("users")
        .select("id")
        .ilike("email", email)
        .limit(1)
        .maybeSingle();
      if (u) found = true;

      if (!found) {
        const { data: a } = await supabase
          .from("b2b_applications")
          .select("id")
          .ilike("contact_email", email)
          .limit(1)
          .maybeSingle();
        if (a) found = true;
      }
    } else {
      // Phone — match on the last 10 digits, tolerant of +91 / 0 / spaces.
      const last10 = digitsOnly(identifier).slice(-10);
      if (last10.length >= 6) {
        const pattern = `%${last10}%`;

        const { data: userHit } = await supabase
          .from("users")
          .select("id")
          .ilike("phone", pattern)
          .limit(1)
          .maybeSingle();
        if (userHit) found = true;

        if (!found) {
          const { data: appHit } = await supabase
            .from("b2b_applications")
            .select("id")
            .or(`contact_phone.ilike.${pattern},mobile_number.ilike.${pattern}`)
            .limit(1)
            .maybeSingle();
          if (appHit) found = true;
        }

        if (!found) {
          const { data: companyHit } = await supabase
            .from("companies")
            .select("id")
            .ilike("phone", pattern)
            .limit(1)
            .maybeSingle();
          if (companyHit) found = true;
        }
      }
    }

    return ok({ user_found: found, identifier });
  } catch (err) {
    console.error("[validate-user] lookup error:", err);
    // Per contract, always 200. Fail-closed on errors.
    return ok({ user_found: false, identifier });
  }
});
