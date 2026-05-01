// Banyan Central Parser
// Triggered every 30s by pg_cron. Finds senders whose latest buffered message is >60s old,
// bundles their messages, runs Vision+Text AI, matches to companies / shadow_clients,
// and writes a row into suggested_orders for Ops review.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PORTAL_URL = "https://b2b.oasisbaklawa.com";
const VISION_MODEL = "google/gemini-2.5-flash";
const IDLE_SECONDS = 60;

interface BufferRow {
  id: string;
  sender_phone: string;
  sender_name: string | null;
  message_type: string;
  text_content: string | null;
  media_url: string | null;
  media_mime_type: string | null;
  raw_payload: any;
  created_at: string;
}

function normalizePhone(raw: string): string {
  const d = (raw || "").replace(/\D/g, "");
  return d.length >= 10 ? d.slice(-10) : d;
}

function to91(raw: string): string {
  const d = (raw || "").replace(/\D/g, "");
  if (d.length === 10) return `91${d}`;
  if (d.length === 12 && d.startsWith("91")) return d;
  return d;
}

async function callVisionAI(textBundle: string, imageUrls: string[]): Promise<{
  business_name: string | null;
  items: { product_name: string; quantity: number; unit: string | null; notes: string | null }[];
  delivery_date: string | null;
  notes: string | null;
  confidence: number;
}> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) {
    return { business_name: null, items: [], delivery_date: null, notes: null, confidence: 0 };
  }

  const systemPrompt = `You are the Oasis Baklawa Central Parser. Extract structured order intent from a bundle of WhatsApp messages (text + invoice/PO images). Return ONLY a tool call.

CHAIN-OF-THOUGHT EXTRACTION PROTOCOL (mandatory):
1. Read the bundle line-by-line. Do NOT skim or summarize.
2. For each line, isolate ONLY explicit number-unit-product triples that are physically adjacent (e.g., "30 kg spl pyramid", "5 box baklawa"). The number, unit, and product name MUST appear next to each other in the same clause.
3. NEVER carry a quantity from one product to another. NEVER infer a quantity from context, prior messages, or surrounding lines. If a product name appears without an adjacent number, SKIP it entirely.
4. If a unit is malformed, glued to other characters, or genuinely unclear (e.g., "kgMor", "k g", garbled OCR), DO NOT GUESS. Emit the item with quantity=null, unit=null, and set its row-level note to "ambiguous_unit". This forces human review.
5. If the same product appears multiple times with different quantities, emit each occurrence as a SEPARATE item — never sum or merge silently.
6. raw_source: for EVERY item you emit, copy the exact source substring (max 80 chars) you extracted it from. This is non-negotiable — it is the audit trail.

OUTPUT RULES:
- business_name: buyer's company / shop name if visible on letterhead, signature, or stated in text. Null if unclear.
- items: array of {product_name, quantity (number or null), unit ("kg"|"gm"|"pcs"|"box"|"carton"|null), notes (string or null), raw_source (string)}.
- delivery_date: ISO date (YYYY-MM-DD) if explicitly stated, else null.
- confidence: 0.0-1.0 — REDUCE this aggressively. If ANY item has null quantity or ambiguous unit, confidence MUST be ≤ 0.5.

When in doubt, return less data with higher integrity. Hallucinated quantities are a critical failure.`;

  const userContent: any[] = [{ type: "text", text: `Message bundle:\n\n${textBundle || "(no text)"}` }];
  for (const url of imageUrls.slice(0, 4)) {
    userContent.push({ type: "image_url", image_url: { url } });
  }

  const tools = [{
    type: "function",
    function: {
      name: "extract_order_intent",
      description: "Return the parsed order intent.",
      parameters: {
        type: "object",
        properties: {
          business_name: { type: ["string", "null"] },
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                product_name: { type: "string" },
                quantity: { type: "number" },
                unit: { type: ["string", "null"] },
                notes: { type: ["string", "null"] },
              },
              required: ["product_name", "quantity"],
              additionalProperties: false,
            },
          },
          delivery_date: { type: ["string", "null"] },
          notes: { type: ["string", "null"] },
          confidence: { type: "number" },
        },
        required: ["business_name", "items", "delivery_date", "confidence"],
        additionalProperties: false,
      },
    },
  }];

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: VISION_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        tools,
        tool_choice: { type: "function", function: { name: "extract_order_intent" } },
      }),
    });

    if (!res.ok) {
      const t = await res.text();
      console.error(`Vision AI error ${res.status}: ${t.slice(0, 300)}`);
      return { business_name: null, items: [], delivery_date: null, notes: null, confidence: 0 };
    }

    const data = await res.json();
    const call = data?.choices?.[0]?.message?.tool_calls?.[0];
    if (!call?.function?.arguments) {
      return { business_name: null, items: [], delivery_date: null, notes: null, confidence: 0 };
    }
    const args = JSON.parse(call.function.arguments);
    return {
      business_name: args.business_name ?? null,
      items: Array.isArray(args.items) ? args.items : [],
      delivery_date: args.delivery_date ?? null,
      notes: args.notes ?? null,
      confidence: typeof args.confidence === "number" ? args.confidence : 0,
    };
  } catch (e) {
    console.error("Vision AI exception:", e);
    return { business_name: null, items: [], delivery_date: null, notes: null, confidence: 0 };
  }
}

async function sendWhatsAppText(phone: string, message: string) {
  const apiKey = Deno.env.get("CLICK2API_API_KEY");
  if (!apiKey) return;
  const accessToken = Deno.env.get("CLICK2API_ACCESS_TOKEN");
  const apiPhone = to91(phone);
  try {
    await fetch("https://crm.click2api.in/api/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: apiKey,
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: apiPhone,
        type: "text",
        text: { body: message },
      }),
    });
  } catch (e) {
    console.error("WA send error:", e);
  }
}

function fuzzyMatchCompany(extractedName: string, companies: { id: string; business_name: string }[]): string | null {
  if (!extractedName) return null;
  const target = extractedName.toLowerCase().trim();
  const direct = companies.find((c) => c.business_name.toLowerCase().trim() === target);
  if (direct) return direct.id;
  const contains = companies.find(
    (c) =>
      c.business_name.toLowerCase().includes(target) ||
      target.includes(c.business_name.toLowerCase()),
  );
  if (contains) return contains.id;
  // token overlap
  const targetTokens = target.split(/\s+/).filter((t) => t.length > 3);
  let best: { id: string; score: number } | null = null;
  for (const c of companies) {
    const tokens = c.business_name.toLowerCase().split(/\s+/).filter((t) => t.length > 3);
    const overlap = tokens.filter((t) => targetTokens.includes(t)).length;
    if (overlap >= 2 && (!best || overlap > best.score)) best = { id: c.id, score: overlap };
  }
  return best?.id ?? null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // 1. Find distinct senders whose newest pending message is older than IDLE_SECONDS
    const cutoff = new Date(Date.now() - IDLE_SECONDS * 1000).toISOString();
    const { data: pending, error: pendErr } = await supabaseAdmin
      .from("whatsapp_buffer")
      .select("sender_phone, created_at")
      .eq("bundle_status", "pending")
      .order("created_at", { ascending: false });

    if (pendErr) throw pendErr;
    if (!pending || pending.length === 0) {
      return new Response(JSON.stringify({ ok: true, processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Group by sender; pick most recent message per sender
    const senderLatest = new Map<string, string>();
    for (const row of pending as { sender_phone: string; created_at: string }[]) {
      if (!senderLatest.has(row.sender_phone)) senderLatest.set(row.sender_phone, row.created_at);
    }

    const eligibleSenders: string[] = [];
    for (const [sender, latest] of senderLatest.entries()) {
      if (latest < cutoff) eligibleSenders.push(sender);
    }

    if (eligibleSenders.length === 0) {
      return new Response(JSON.stringify({ ok: true, processed: 0, waiting: senderLatest.size }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let processed = 0;

    // Preload companies once
    const { data: companies } = await supabaseAdmin
      .from("companies")
      .select("id, business_name")
      .order("business_name");

    for (const sender of eligibleSenders) {
      // Lock this sender's pending rows by flipping to 'flushing'
      const { data: rows, error: lockErr } = await supabaseAdmin
        .from("whatsapp_buffer")
        .update({ bundle_status: "flushing" })
        .eq("sender_phone", sender)
        .eq("bundle_status", "pending")
        .select("id, sender_phone, sender_name, message_type, text_content, media_url, media_mime_type, raw_payload, created_at");

      if (lockErr || !rows || rows.length === 0) continue;
      const bundle = rows as BufferRow[];

      // Aggregate
      const senderName = bundle.find((r) => r.sender_name)?.sender_name || null;
      const textContent = bundle
        .map((r) => r.text_content)
        .filter(Boolean)
        .join("\n---\n");
      const imageUrls = bundle
        .filter((r) => r.media_url && (r.media_mime_type || "").startsWith("image/"))
        .map((r) => r.media_url!) as string[];
      const messageIds = bundle.map((r) => r.id);

      // 2. Vision + Text AI
      const ai = await callVisionAI(textContent, imageUrls);

      // 3. Match to company
      const matchedCompanyId = ai.business_name
        ? fuzzyMatchCompany(ai.business_name, (companies || []) as any)
        : null;

      let shadowClientId: string | null = null;
      if (!matchedCompanyId) {
        // upsert shadow client by phone
        const { data: existing } = await supabaseAdmin
          .from("shadow_clients")
          .select("id, last_prompt_sent_at")
          .eq("sender_phone", sender)
          .maybeSingle();

        if (existing) {
          shadowClientId = (existing as any).id;
          await supabaseAdmin
            .from("shadow_clients")
            .update({
              extracted_business_name: ai.business_name || (existing as any).extracted_business_name || null,
              sender_name: senderName,
            })
            .eq("id", shadowClientId);
        } else {
          const { data: created } = await supabaseAdmin
            .from("shadow_clients")
            .insert({
              sender_phone: sender,
              sender_name: senderName,
              extracted_business_name: ai.business_name,
              status: "awaiting_details",
            })
            .select("id")
            .single();
          shadowClientId = (created as any)?.id ?? null;
        }

        // Send WA reply asking for missing details (rate-limit: only if not sent in last 6h)
        const sixHoursAgo = new Date(Date.now() - 6 * 3600 * 1000).toISOString();
        const { data: recent } = await supabaseAdmin
          .from("shadow_clients")
          .select("last_prompt_sent_at")
          .eq("id", shadowClientId)
          .maybeSingle();
        const lastPrompt = (recent as any)?.last_prompt_sent_at;
        if (!lastPrompt || lastPrompt < sixHoursAgo) {
          const greeting = senderName ? `Hello ${senderName},` : "Hello,";
          const msg = `${greeting}\n\nThank you for reaching out to Oasis Baklawa. To process your order, we need a few details:\n\n• Business / Trade Name\n• GST Number\n• Delivery Address with Pincode\n\nOnce confirmed, your order will move to production.\n\nTrack & manage future orders here:\n${PORTAL_URL}\n\n— Team Oasis Baklawa`;
          await sendWhatsAppText(sender, msg);
          await supabaseAdmin
            .from("shadow_clients")
            .update({ last_prompt_sent_at: new Date().toISOString() })
            .eq("id", shadowClientId);
        }
      }

      // 4. Insert into Suggested Orders pool (only if anything meaningful was extracted)
      if (ai.items.length > 0 || ai.business_name || imageUrls.length > 0) {
        await supabaseAdmin.from("suggested_orders").insert({
          sender_phone: sender,
          sender_name: senderName,
          matched_company_id: matchedCompanyId,
          shadow_client_id: shadowClientId,
          extracted_business_name: ai.business_name,
          extracted_items: ai.items,
          extracted_delivery_date: ai.delivery_date,
          extracted_notes: ai.notes,
          source_image_url: imageUrls[0] || null,
          source_text: textContent || null,
          source_message_ids: messageIds,
          ai_confidence: ai.confidence,
          ai_model: VISION_MODEL,
          status: "pending_review",
        });
      }

      // 5. Mark buffer rows as flushed
      await supabaseAdmin
        .from("whatsapp_buffer")
        .update({ bundle_status: "flushed", flushed_at: new Date().toISOString() })
        .in("id", messageIds);

      processed += 1;
    }

    return new Response(JSON.stringify({ ok: true, processed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("banyan-central-parser error:", e);
    return new Response(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : "unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
