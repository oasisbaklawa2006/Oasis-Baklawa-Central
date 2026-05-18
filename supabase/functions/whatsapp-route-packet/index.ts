// supabase/functions/whatsapp-route-packet/index.ts
// TOOL 4: Routing suggestion (read-only). Returns JSON only — no database writes.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type IntentType =
  | "order_inquiry"
  | "complaint"
  | "reorder"
  | "general_inquiry"
  | "spam";

type TeamLabel = "SALES" | "SUPPORT" | "OPERATIONS" | "FINANCE" | "CEO";
type Priority = "high" | "normal" | "low";

interface RoutePayload {
  packet_id?: string;
  contact_id?: string;
  intent?: { intent_type?: string; confidence?: number; keywords?: string[]; metadata?: unknown };
}

interface RoutingDecision {
  assigned_to_team: TeamLabel;
  priority: Priority;
  action: string;
  reason: string;
  metadata: Record<string, unknown>;
}

function normalizeIntentType(raw: unknown): IntentType {
  const s = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (
    s === "order_inquiry" ||
    s === "complaint" ||
    s === "reorder" ||
    s === "general_inquiry" ||
    s === "spam"
  ) {
    return s;
  }
  return "general_inquiry";
}

function suggestRoute(intent: IntentType, stitchedSnippet: string): RoutingDecision {
  const snippet = stitchedSnippet.slice(0, 200).toLowerCase();

  switch (intent) {
    case "spam":
      return {
        assigned_to_team: "SUPPORT",
        priority: "low",
        action: "Hold automated replies; review for blocklist policy if needed.",
        reason: "Intent classified as spam — low-touch triage.",
        metadata: { intent },
      };
    case "complaint":
      return {
        assigned_to_team: "SUPPORT",
        priority: "high",
        action: "Acknowledge issue, gather order reference and photos if applicable.",
        reason: "Customer complaint — needs timely human response.",
        metadata: { intent },
      };
    case "reorder":
      return {
        assigned_to_team: "SALES",
        priority: "high",
        action: "Confirm SKU, quantities, and delivery window against prior order pattern.",
        reason: "Repeat purchase signal — prioritize fulfillment accuracy.",
        metadata: { intent },
      };
    case "order_inquiry":
      return {
        assigned_to_team: "SALES",
        priority: "normal",
        action: "Prepare quotation or catalog pointers; confirm GST and delivery address.",
        reason: "Commerce or pricing language detected.",
        metadata: { intent },
      };
    default:
      if (/\b(invoice|gst|payment|credit|ledger|accounts)\b/i.test(snippet)) {
        return {
          assigned_to_team: "FINANCE",
          priority: "normal",
          action: "Route to accounts for invoice, credit, or payment clarification.",
          reason: "Stitched text hints at finance-related topic.",
          metadata: { intent, hint: "finance_keywords" },
        };
      }
      if (/\b(dispatch|delivery|truck|logistics|warehouse)\b/i.test(snippet)) {
        return {
          assigned_to_team: "OPERATIONS",
          priority: "normal",
          action: "Check dispatch status or production slot with ops.",
          reason: "Stitched text hints at logistics or operations topic.",
          metadata: { intent, hint: "operations_keywords" },
        };
      }
      if (/\b(escalat|legal|ceo|owner|urgent.*management)\b/i.test(snippet)) {
        return {
          assigned_to_team: "CEO",
          priority: "high",
          action: "Senior review — confirm facts before executive reply.",
          reason: "Escalation or executive-sensitive language (heuristic).",
          metadata: { intent, hint: "escalation_heuristic" },
        };
      }
      return {
        assigned_to_team: "SALES",
        priority: "normal",
        action: "General triage: clarify customer goal and assign to correct desk.",
        reason: "General inquiry — default sales-first routing.",
        metadata: { intent },
      };
  }
}

function stitchedTextPreview(sc: unknown): string {
  if (sc == null) return "";
  if (typeof sc === "string") return sc;
  if (typeof sc === "object" && !Array.isArray(sc)) {
    const o = sc as Record<string, unknown>;
    const text = o.text;
    const summary = o.summary;
    if (typeof text === "string" && text.trim()) return text;
    if (typeof summary === "string" && summary.trim()) return summary;
  }
  return "";
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
    const body = (await req.json().catch(() => ({}))) as RoutePayload;
    const packetId = typeof body.packet_id === "string" ? body.packet_id.trim() : "";
    if (!packetId) {
      return new Response(
        JSON.stringify({ success: false, error: "packet_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let query = supabaseAdmin
      .from("whatsapp_message_packets")
      .select("id, stitched_content, contact_id")
      .eq("id", packetId);

    if (body.contact_id?.trim()) {
      query = query.eq("contact_id", body.contact_id.trim());
    }

    const { data: packet, error } = await query.maybeSingle();

    if (error) {
      console.error("[whatsapp-route-packet] select failed:", error.message);
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const stitched = packet?.stitched_content ?? null;
    const stitchedSnippet = stitchedTextPreview(stitched);

    let intentSource: "payload" | "stitched_content" | "default" = "default";
    let intent: IntentType = "general_inquiry";

    if (body.intent?.intent_type != null) {
      intent = normalizeIntentType(body.intent.intent_type);
      intentSource = "payload";
    } else if (
      stitched &&
      typeof stitched === "object" &&
      !Array.isArray(stitched) &&
      "intent_type" in stitched
    ) {
      intent = normalizeIntentType((stitched as Record<string, unknown>).intent_type);
      intentSource = "stitched_content";
    }

    const decision = suggestRoute(intent, stitchedSnippet);
    decision.metadata = {
      ...decision.metadata,
      packet_id: packetId,
      intent_source: intentSource,
      resolved_intent: intent,
      stitched_preview_chars: stitchedSnippet.length,
    };

    return new Response(JSON.stringify({ success: true, decision }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("[whatsapp-route-packet]", msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
