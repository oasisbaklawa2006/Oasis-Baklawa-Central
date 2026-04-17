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
        status: 200,
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
    const internalEmail = `wa_${normalizedPhone}@oasis.internal`;

    // ── EMAIL BACKUP: send same OTP via Resend ──
    if (action === "email_backup") {
      // Look up cached OTP
      const { data: settingRow } = await supabaseAdmin
        .from("app_settings")
        .select("setting_value")
        .eq("setting_key", `wa_otp_${normalizedPhone}`)
        .maybeSingle();
      const sv = settingRow?.setting_value as any;
      if (!sv?.code || Date.now() > sv.expiresAt) {
        return new Response(JSON.stringify({ error: "OTP expired or missing" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Find recipient email from b2b_applications
      const { data: app } = await supabaseAdmin
        .from("b2b_applications")
        .select("contact_email")
        .eq("mobile_number", cleaned)
        .maybeSingle();

      const recipientEmail = app?.contact_email;
      if (!recipientEmail) {
        return new Response(JSON.stringify({ error: "No verified email on file for this number" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const resendKey = Deno.env.get("RESEND_API_KEY");
      if (!resendKey) {
        return new Response(JSON.stringify({ error: "Email service unavailable" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const emailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
        body: JSON.stringify({
          from: "Oasis Baklawa <team@oasisbaklawa.com>",
          to: recipientEmail,
          subject: `Your Oasis B2B Login OTP: ${sv.code}`,
          html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px">
            <h2 style="color:#1a1a1a">Oasis Baklawa B2B</h2>
            <p>Your one-time login code is:</p>
            <div style="font-size:32px;font-weight:700;letter-spacing:6px;color:#c9a961;padding:16px;background:#faf7f0;border-radius:8px;text-align:center;margin:16px 0">${sv.code}</div>
            <p style="font-size:13px;color:#666">This code expires in 5 minutes. If you didn't request it, please ignore this email.</p>
            <p style="font-size:12px;color:#888;margin-top:24px">— Team Oasis Baklawa</p>
          </div>`,
        }),
      });

      return new Response(JSON.stringify({ success: emailRes.ok, sent_to: recipientEmail.replace(/(.{2}).+@/, "$1***@") }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── SEND OTP ──
    if (action === "send") {
      const code = generateOTP();
      otpStore.set(normalizedPhone, { code, expiresAt: Date.now() + 5 * 60 * 1000 });

      await supabaseAdmin.from("app_settings").upsert({
        setting_key: `wa_otp_${normalizedPhone}`,
        setting_value: { code, expiresAt: Date.now() + 5 * 60 * 1000 },
        updated_at: new Date().toISOString(),
      }, { onConflict: "setting_key" });

      // Approved Meta template "b2b_otp_login" — body-only (no button)
      const templatePayload = {
        instance_id: apiKey,
        access_token: accessToken ?? "",
        number: normalizedPhone, // 91xxxxxxxxxx, no '+'
        type: "template",
        template_name: "b2b_otp_login",
        language_code: "en",
        body_params: [code],
        template: {
          name: "b2b_otp_login",
          language: { code: "en" },
          components: [
            {
              type: "body",
              parameters: [{ type: "text", text: code }],
            },
          ],
        },
        components: [
          {
            type: "body",
            parameters: [{ type: "text", text: code }],
          },
        ],
      };

      const apiRes = await fetch(SEND_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: apiKey,
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify(templatePayload),
      });

      const responseText = await apiRes.text();
      let apiData: any;
      try { apiData = JSON.parse(responseText); } catch { apiData = { raw: responseText.substring(0, 500) }; }

      console.log(`WhatsApp OTP send (${apiRes.status}) to ${normalizedPhone}`);

      if (!apiRes.ok) {
        return new Response(JSON.stringify({ error: "Failed to send OTP via WhatsApp", details: apiData }), {
          status: 200,
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
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (Date.now() > stored.expiresAt) {
        otpStore.delete(normalizedPhone);
        await supabaseAdmin.from("app_settings").delete().eq("setting_key", `wa_otp_${normalizedPhone}`);
        return new Response(JSON.stringify({ error: "OTP expired. Please request a new one." }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (stored.code !== otp) {
        return new Response(JSON.stringify({ error: "Invalid OTP. Please try again." }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // OTP verified — clean up
      otpStore.delete(normalizedPhone);
      await supabaseAdmin.from("app_settings").delete().eq("setting_key", `wa_otp_${normalizedPhone}`);

      // ── Find or create user ──
      let userId: string;
      let isNewUser = false;
      let userEmail = internalEmail;

      // Step 1: Check if phone user already exists by trying to find them
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const allUsers = existingUsers?.users || [];
      const matchedUser = allUsers.find(
        (u: any) => u.phone === e164 || u.phone === normalizedPhone || u.phone === `+${normalizedPhone}`,
      );

      if (matchedUser) {
        userId = matchedUser.id;
        userEmail = matchedUser.email || internalEmail;

        // Ensure the user has an email set (needed for magiclink generation)
        if (!matchedUser.email) {
          await supabaseAdmin.auth.admin.updateUserById(userId, { email: internalEmail, email_confirm: true });
          userEmail = internalEmail;
        }
      } else {
        // Create new user with both phone and internal email
        const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
          phone: e164,
          phone_confirm: true,
          email: internalEmail,
          email_confirm: true,
        });

        if (createErr) {
          // If phone_exists error despite not finding in list (pagination edge case)
          if (createErr.message?.toLowerCase().includes("already") || createErr.message?.toLowerCase().includes("exists") || createErr.message?.toLowerCase().includes("registered")) {
            // Try paginating further
            let page = 2;
            let found = false;
            userId = "";
            while (!found && page <= 20) {
              const { data: pageData } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 500 });
              const users = pageData?.users || [];
              if (users.length === 0) break;
              const match = users.find((u: any) => u.phone === e164 || u.phone === normalizedPhone || u.phone === `+${normalizedPhone}`);
              if (match) { 
                userId = match.id; 
                userEmail = match.email || internalEmail;
                found = true; 
              }
              page++;
            }
            if (!found) {
              return new Response(JSON.stringify({ error: "Account exists but could not be located. Please try Email login or contact support." }), {
                status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
              });
            }
          } else {
            console.error("createUser error:", createErr.message);
            return new Response(JSON.stringify({ error: "SERVICE_FAILED", fallback: true, details: createErr.message }), {
              status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        } else {
          userId = newUser!.user.id;
          isNewUser = true;
        }
      }

      // ── Generate a magiclink token so the client can establish a session ──
      let tokenHash: string | null = null;
      let redirectUrl: string | null = null;

      try {
        const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
          type: "magiclink",
          email: userEmail,
          options: { redirectTo: "https://b2b.oasisbaklawa.com/welcome" },
        });

        if (linkData && !linkErr) {
          // Extract token_hash from the action_link URL
          const url = new URL(linkData.properties?.action_link || "");
          tokenHash = url.searchParams.get("token") || url.hash?.match(/token=([^&]+)/)?.[1] || null;
          
          // Also try hashed_token from properties
          if (!tokenHash && (linkData.properties as any)?.hashed_token) {
            tokenHash = (linkData.properties as any).hashed_token;
          }
          
          // Parse token_hash from the URL fragment if present
          if (!tokenHash && linkData.properties?.action_link) {
            const linkUrl = linkData.properties.action_link;
            const hashMatch = linkUrl.match(/token_hash=([^&]+)/);
            if (hashMatch) tokenHash = hashMatch[1];
          }
        } else {
          console.error("generateLink error:", linkErr?.message);
        }
      } catch (e) {
        console.error("generateLink exception:", e);
      }

      return new Response(JSON.stringify({
        success: true,
        verified: true,
        userId,
        isNewUser,
        phone: e164,
        email: userEmail,
        token_hash: tokenHash,
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
    return new Response(JSON.stringify({ error: message, fallback: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
