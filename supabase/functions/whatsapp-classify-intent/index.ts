// supabase/functions/whatsapp-classify-intent/index.ts
// TOOL 3: Intent suggestion (read-only). Returns JSON only — no database writes.

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

interface ClassifyPayload {
  packet_id?: string;
  contact_id?: string;
}

interface IntentResult {
  intent_type: IntentType;
  confidence: number;
  keywords: string[];
  metadata: Record<string, unknown>;
}

function classifyInboundText(text: string): IntentResult {
  const t = text.toLowerCase();
  const keywords: string[] = [];

  const pushKw = (label: string, re: RegExp) => {
    const m = t.match(re);
    if (m) keywords.push(label);
  };

  // Spam / promo signals (heuristic, same spirit as identify-sender)
  let spamScore = 0;
  if (/https?:\/\/[^\s]+/i.test(text)) {
    spamScore += 0.35;
    pushKw("url", /https?:\/\/[^\s]+/i);
  }
  if (/\b(bit\.ly|tinyurl|t\.me\/|whatsapp.*prize|congratulations you won|click here)\b/i.test(t)) {
    spamScore += 0.45;
    pushKw("spam_phrase", /\b(bit\.ly|tinyurl|t\.me\/)/i);
  }
  if (spamScore >= 0.55) {
    return {
      intent_type: "spam",
      confidence: Math.min(0.95, 0.5 + spamScore * 0.5),
      keywords,
      metadata: { classifier: "rule_heuristic", signals: ["link_or_spam_phrase"] },
    };
  }

  const complaintRe =
    /\b(refund|damaged|broken|late delivery|not received|worst|terrible|complaint|disappointed|wrong item|missing)\b/i;
  if (complaintRe.test(t)) {
    const m = t.match(complaintRe);
    if (m?.[0]) keywords.push(m[0]);
    return {
      intent_type: "complaint",
      confidence: 0.78,
      keywords: [...new Set(keywords)],
      metadata: { classifier: "rule_keyword", matched: "complaint" },
    };
  }

  const reorderRe =
    /\b(reorder|repeat order|same as last|again please|same order|duplicate order)\b/i;
  if (reorderRe.test(t)) {
    const m = t.match(reorderRe);
    if (m?.[0]) keywords.push(m[0]);
    return {
      intent_type: "reorder",
      confidence: 0.8,
      keywords: [...new Set(keywords)],
      metadata: { classifier: "rule_keyword", matched: "reorder" },
    };
  }

  const orderRe =
    /\b(order|quote|quotation|price|rate|kg|kgs|box|boxes|carton|pieces|pcs|need|want|send|dispatch|invoice|gst)\b/i;
  if (orderRe.test(t)) {
    const m = t.match(orderRe);
    if (m?.[0]) keywords.push(m[0]);
    return {
      intent_type: "order_inquiry",
      confidence: 0.72,
      keywords: [...new Set(keywords)],
      metadata: { classifier: "rule_keyword", matched: "order_commerce" },
    };
  }

  return {
    intent_type: "general_inquiry",
    confidence: 0.55,
    keywords,
    metadata: { classifier: "rule_default" },
  };
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
    const body = (await req.json().catch(() => ({}))) as ClassifyPayload;
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
      .from("whatsapp_messages")
      .select("id, content, direction, packet_sequence, created_at")
      .eq("packet_id", packetId)
      .eq("direction", "inbound")
      .order("packet_sequence", { ascending: true, nullsFirst: false });

    if (body.contact_id?.trim()) {
      query = query.eq("contact_id", body.contact_id.trim());
    }

    const { data: rows, error } = await query;

    if (error) {
      console.error("[whatsapp-classify-intent] select failed:", error.message);
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!rows?.length) {
      return new Response(
        JSON.stringify({
          success: true,
          intent: {
            intent_type: "general_inquiry" satisfies IntentType,
            confidence: 0.35,
            keywords: [] as string[],
            metadata: { reason: "no_messages", packet_id: packetId },
          },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const merged = rows
      .map((r) => String((r as { content?: string | null }).content ?? "").trim())
      .filter(Boolean)
      .join("\n");

    if (!merged.trim()) {
      return new Response(
        JSON.stringify({
          success: true,
          intent: {
            intent_type: "general_inquiry" satisfies IntentType,
            confidence: 0.4,
            keywords: [] as string[],
            metadata: { reason: "empty_inbound_content", packet_id: packetId, row_count: rows.length },
          },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const intent = classifyInboundText(merged);
    intent.metadata = {
      ...intent.metadata,
      packet_id: packetId,
      inbound_fragment_count: rows.length,
    };

    return new Response(JSON.stringify({ success: true, intent }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("[whatsapp-classify-intent]", msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
