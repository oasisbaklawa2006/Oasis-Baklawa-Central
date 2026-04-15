import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BASE_URL = "https://crm.click2api.in";
const SEND_ENDPOINT = `${BASE_URL}/api/v1/messages`;

// In-memory OTP store (edge function instance scoped)
const otpStore = new Map<string, { code: string; expiresAt: number }>();

function generateOTP(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("CLICK2API_API_KEY");
    const accessToken = Deno.env.get("CLICK2API_ACCESS_TOKEN");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "WhatsApp API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json();
    const { action, phone, otp } = body;

    if (!phone) {
      return new Response(JSON.stringify({ error: "phone is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cleaned = phone.replace(/\D/g, "");
    const normalizedPhone = cleaned.length === 10 ? `91${cleaned}` : cleaned;
    const e164 = `+${normalizedPhone}`;

    // ── SEND OTP ──
    if (action === "send") {
      const code = generateOTP();
      // Store OTP with 5-min expiry
      otpStore.set(normalizedPhone, { code, expiresAt: Date.now() + 5 * 60 * 1000 });

      // Also persist in DB for cross-instance verification
      await supabaseAdmin.from("app_settings").upsert({
        setting_key: `wa_otp_${normalizedPhone}`,
        setting_value: { code, expiresAt: Date.now() + 5 * 60 * 1000 },
        updated_at: new Date().toISOString(),
      }, { onConflict: "setting_key" });

      const message = `🔐 Your Oasis B2B Login OTP is: *${code}*\n\nValid for 5 minutes. Do not share this code.`;

      const apiRes = await fetch(SEND_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: apiKey,
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: normalizedPhone,
          type: "text",
          text: { body: message },
        }),
      });

      const responseText = await apiRes.text();
      let apiData: any;
      try { apiData = JSON.parse(responseText); } catch { apiData = { raw: responseText.substring(0, 500) }; }

      console.log(`WhatsApp OTP send (${apiRes.status}) to ${normalizedPhone}`);

      if (!apiRes.ok) {
        return new Response(JSON.stringify({ error: "Failed to send OTP via WhatsApp", details: apiData }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, message: "OTP sent" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── VERIFY OTP ──
    if (action === "verify") {
      if (!otp) {
        return new Response(JSON.stringify({ error: "otp is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check in-memory first, then DB fallback
      let stored = otpStore.get(normalizedPhone);

      if (!stored) {
        const { data } = await supabaseAdmin
          .from("app_settings")
          .select("setting_value")
          .eq("setting_key", `wa_otp_${normalizedPhone}`)
          .maybeSingle();

        if (data?.setting_value) {
          const sv = data.setting_value as any;
          stored = { code: sv.code, expiresAt: sv.expiresAt };
        }
      }

      if (!stored) {
        return new Response(JSON.stringify({ error: "No OTP found. Please request a new one." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (Date.now() > stored.expiresAt) {
        otpStore.delete(normalizedPhone);
        await supabaseAdmin.from("app_settings").delete().eq("setting_key", `wa_otp_${normalizedPhone}`);
        return new Response(JSON.stringify({ error: "OTP expired. Please request a new one." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (stored.code !== otp) {
        return new Response(JSON.stringify({ error: "Invalid OTP. Please try again." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // OTP verified — clean up
      otpStore.delete(normalizedPhone);
      await supabaseAdmin.from("app_settings").delete().eq("setting_key", `wa_otp_${normalizedPhone}`);

      // Find or create user by phone
      // First check if a user exists with this phone in auth
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
      const matchedUser = existingUsers?.users?.find(
        (u: any) => u.phone === e164 || u.phone === `+${normalizedPhone}`,
      );

      let userId: string;
      let isNewUser = false;

      if (matchedUser) {
        userId = matchedUser.id;
      } else {
        // Create a new user with this phone
        const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
          phone: e164,
          phone_confirm: true,
        });
        if (createErr || !newUser?.user) {
          return new Response(JSON.stringify({ error: "Failed to create user account" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        userId = newUser.user.id;
        isNewUser = true;
      }

      // Generate a session token for this user
      const { data: session, error: sessionErr } = await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email: `wa_${normalizedPhone}@oasis.internal`,
      });

      // Use signInWithPassword alternative — generate a custom token
      // Since we can't directly create sessions via admin API easily,
      // we'll use the OTP flow built into Supabase
      // Try to sign in via phone OTP natively
      const { data: signInData, error: signInErr } = await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email: matchedUser?.email || `wa_${normalizedPhone}@oasis.internal`,
      });

      return new Response(JSON.stringify({
        success: true,
        verified: true,
        userId,
        isNewUser,
        phone: e164,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action. Use 'send' or 'verify'." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unexpected error";
    console.error("whatsapp-otp error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
