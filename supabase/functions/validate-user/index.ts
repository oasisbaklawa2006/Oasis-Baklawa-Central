// B2B User Validation Gatekeeper
// -------------------------------
// GET /validate-user?identifier=<phone or email>
// Returns 200 always (MSG91 contract):
//   { user_found: true,  identifier: "+91XXXXXXXXXX" | "user@x.com" }
//   { user_found: false, identifier: "<normalized>" }
//
// Lookup strategy:
//   - Email   → users.email  ∪ b2b_applications.contact_email  (case-insensitive)
//   - Phone   → users.phone  ∪ b2b_applications.mobile_number  (E.164 normalized: +91XXXXXXXXXX)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const ok = (body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function isEmail(s: string): boolean {
  return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(s);
}

/** Normalize any Indian phone input to E.164 (+91XXXXXXXXXX). */
function toE164(raw: string): string {
  const d = (raw || "").replace(/\\D/g, "");
  if (d.length === 10) return `+91${d}`;
  if (d.length === 12 && d.startsWith("91")) return `+${d}`;
  if (d.length === 11 && d.startsWith("0")) return `+91${d.slice(1)}`;
  if (d.length >= 10) return `+${d.slice(-12)}`;
  return raw.startsWith("+") ? raw : `+${d}`;
}

/** Last 10 digits — useful for matching legacy rows stored without +91. */
function last10(raw: string): string {
  const d = (raw || "").replace(/\\D/g, "");
  return d.slice(-10);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Accept identifier from query string (GET) OR JSON body (POST) for flexibility.
    let identifier = "";
    if (req.method === "GET") {
      identifier = new URL(req.url).searchParams.get("identifier") ?? "";
    } else {
      const body = await req.json().catch(() => ({}));
      identifier = body?.identifier ?? "";
    }
    identifier = String(identifier).trim();

    if (!identifier) {
      // Per MSG91 contract → still 200, just user_found=false.
      return ok({ user_found: false, error: "identifier required" });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ─── EMAIL PATH ────────────────────────────────────────────────────────
    if (isEmail(identifier)) {
      const email = identifier.toLowerCase();

      const [{ data: u }, { data: a }] = await Promise.all([
        supabase.from("users").select("id").ilike("email", email).limit(1).maybeSingle(),
        supabase.from("b2b_applications").select("id").ilike("contact_email", email).limit(1).maybeSingle(),
      ]);

      return ok({ user_found: Boolean(u || a), identifier: email });
    }

    // ─── PHONE PATH ────────────────────────────────────────────────────────
    const e164 = toE164(identifier);
    const tail = last10(identifier);

    // Match common stored variants: +91XXXXXXXXXX, 91XXXXXXXXXX, XXXXXXXXXX.
    const phoneVariants = [e164, e164.replace(/^\\+/, ""), tail].filter(Boolean);

    const [{ data: uPhone }, { data: aPhone }] = await Promise.all([
      supabase
        .from("users")
        .select("id")
        .or(phoneVariants.map((v) => `phone.eq.${v}`).join(","))
        .limit(1)
        .maybeSingle(),
      supabase
        .from("b2b_applications")
        .select("id")
        .or(phoneVariants.map((v) => `mobile_number.eq.${v}`).join(","))
        .limit(1)
        .maybeSingle(),
    ]);

    return ok({ user_found: Boolean(uPhone || aPhone), identifier: e164 });
  } catch (e) {
    // Even on internal failure, MSG91 contract requires 200.
    console.error("[validate-user] error:", e);
    return ok({ user_found: false, error: e instanceof Error ? e.message : "unknown" });
  }
});
