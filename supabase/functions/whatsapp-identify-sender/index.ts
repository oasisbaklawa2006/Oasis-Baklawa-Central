// supabase/functions/whatsapp-identify-sender/index.ts
// TOOL 2: Sender identification engine — classify inbound sender as customer, employee, spam, or unknown.
// (Source file /mnt/user-data/outputs/whatsapp-identify-sender-index.ts was not available in this environment.)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/** Roles that route to internal / admin / ops surfaces (see src/lib/auth-routing STAFF_ROLE_DESTINATIONS). */
const STAFF_ROLES = [
  "SUPER_ADMIN",
  "OWNER",
  "ADMIN",
  "FINANCE_HEAD",
  "FINANCE_EXEC",
  "FINANCE_AUDITOR",
  "OPERATIONS_MANAGER",
  "PRODUCTION_MANAGER",
  "HOD_ARABIC",
  "HOD_FUSION",
  "HOD_CHOCOLATE",
  "HOD_DRAGEES",
  "HOD_BAKERY",
  "HOD_NUTS",
  "HOD_ASSEMBLY",
  "PROD_ARABIC_SWEETS",
  "PROD_FUSION",
  "PROD_CHOCOLATE",
  "PROD_DRAGEES",
  "PROD_BAKERY",
  "PROD_NUTS",
  "TV_DISPLAY",
  "TV_ASSEMBLY",
  "TV_READY",
  "STORE_INCHARGE",
  "STORE_READY_GOODS",
  "RGS_ADMIN",
  "STORE_3RD_PARTY",
  "DISPATCH_HEAD",
  "DISPATCH_MANAGER",
  "DISPATCH_INCHARGE",
  "ASSEMBLY_MANAGER",
  "PACKING_SUPERVISOR",
  "SALES_EXECUTIVE",
  "SUPPORT_EXECUTIVE",
  "CATALOGUE_CONTRIBUTOR",
  "SECURITY_CONTROL",
  "GATE_SECURITY",
] as const;

interface IdentifyPayload {
  phone_number: string;
  /** Optional last inbound snippet for lightweight spam heuristics */
  message_text?: string;
  wa_contact_id?: string;
}

export type SenderKind = "customer" | "employee" | "spam" | "unknown";

function normalizeApiPhone(raw: string): string {
  const digitsOnly = raw.replace(/[^0-9]/g, "");
  if (digitsOnly.length === 10) return `91${digitsOnly}`;
  return digitsOnly;
}

function phoneVariants(apiPhone: string, raw: string): string[] {
  const d = apiPhone.replace(/^91/, "");
  const set = new Set<string>([
    raw.trim(),
    apiPhone,
    `+${apiPhone}`,
    d.length === 10 ? d : apiPhone,
    d.length === 10 ? `91${d}` : apiPhone,
    d.length === 10 ? `+91${d}` : apiPhone,
  ]);
  return [...set].filter(Boolean);
}

function spamScore(text: string | undefined): number {
  if (!text || !text.trim()) return 0;
  const t = text.toLowerCase();
  let score = 0;
  if (/https?:\/\/[^\s]+/i.test(text)) score += 0.35;
  if (/\b(bit\.ly|tinyurl|t\.me\/|whatsapp.*prize|congratulations you won)\b/i.test(t)) score += 0.45;
  if (/(.)\1{12,}/.test(text.replace(/\s/g, ""))) score += 0.2;
  const letters = text.replace(/[^a-zA-Z]/g, "");
  if (letters.length > 20) {
    const upper = text.replace(/[^A-Z]/g, "").length;
    if (upper / letters.length > 0.6) score += 0.25;
  }
  return Math.min(1, score);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = (await req.json()) as IdentifyPayload;
    if (!body.phone_number?.trim()) {
      return new Response(
        JSON.stringify({ success: false, error: "phone_number is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const apiPhone = normalizeApiPhone(body.phone_number);
    const sSpam = spamScore(body.message_text);
    if (sSpam >= 0.65) {
      return new Response(
        JSON.stringify({
          success: true,
          sender_kind: "spam" satisfies SenderKind,
          confidence: Number(sSpam.toFixed(2)),
          normalized_phone: apiPhone,
          reason: "heuristic_spam_signals",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const variants = phoneVariants(apiPhone, body.phone_number);

    for (const phone of variants) {
      const { data: staff, error: staffErr } = await supabaseAdmin
        .from("users")
        .select("id, role, phone")
        .eq("phone", phone)
        .in("role", [...STAFF_ROLES])
        .maybeSingle();

      if (staffErr) {
        console.warn("[whatsapp-identify-sender] staff lookup:", staffErr.message);
      }
      if (staff?.id) {
        return new Response(
          JSON.stringify({
            success: true,
            sender_kind: "employee" satisfies SenderKind,
            confidence: 0.9,
            normalized_phone: apiPhone,
            user_id: staff.id,
            role: staff.role,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    const { data: staffSecondaries, error: secErr } = await supabaseAdmin
      .from("users")
      .select("id, role, phone, secondary_phones")
      .in("role", [...STAFF_ROLES])
      .limit(400);

    if (secErr) {
      console.warn("[whatsapp-identify-sender] secondary phone scan:", secErr.message);
    } else if (staffSecondaries?.length) {
      const rows = staffSecondaries.filter((row) =>
        Array.isArray(row.secondary_phones) && (row.secondary_phones as string[]).length > 0
      );
      for (const row of rows) {
        const arr = (row.secondary_phones ?? []) as string[];
        for (const entry of arr) {
          if (!entry) continue;
          const n = normalizeApiPhone(String(entry));
          if (n === apiPhone || variants.includes(String(entry).trim())) {
            return new Response(
              JSON.stringify({
                success: true,
                sender_kind: "employee" satisfies SenderKind,
                confidence: 0.85,
                normalized_phone: apiPhone,
                user_id: row.id,
                role: row.role,
                matched_via: "secondary_phones",
              }),
              { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
            );
          }
        }
      }
    }

    let contact: {
      id: string;
      phone_number: string | null;
      customer_name: string | null;
      company_name: string | null;
      wa_contact_id: string | null;
    } | null = null;

    if (body.wa_contact_id?.trim()) {
      const { data, error: cErr } = await supabaseAdmin
        .from("whatsapp_contacts")
        .select("id, phone_number, customer_name, company_name, wa_contact_id")
        .eq("wa_contact_id", body.wa_contact_id.trim())
        .maybeSingle();
      if (cErr) console.warn("[whatsapp-identify-sender] contact by wa_id:", cErr.message);
      contact = data;
    } else {
      for (const v of variants) {
        const { data, error: cErr } = await supabaseAdmin
          .from("whatsapp_contacts")
          .select("id, phone_number, customer_name, company_name, wa_contact_id")
          .eq("phone_number", v)
          .maybeSingle();
        if (cErr) console.warn("[whatsapp-identify-sender] contact lookup:", cErr.message);
        if (data) {
          contact = data;
          break;
        }
      }
    }

    if (contact) {
      return new Response(
        JSON.stringify({
          success: true,
          sender_kind: "customer" satisfies SenderKind,
          confidence: 0.82,
          normalized_phone: apiPhone,
          contact_id: contact.id,
          customer_name: contact.customer_name,
          company_name: contact.company_name,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        sender_kind: "unknown" satisfies SenderKind,
        confidence: 0.4,
        normalized_phone: apiPhone,
        reason: "no_staff_or_whatsapp_contact_match",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("[whatsapp-identify-sender]", msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
