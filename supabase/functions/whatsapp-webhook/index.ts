import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const WABA_ID = "2215829225584918";

/** Normalize phone to last 10 digits for DB matching */
function normalizePhone(raw: string): string {
  return raw.replace(/[^0-9]/g, "").slice(-10);
}

/** Fuzzy match a text fragment against product names — returns best match */
function fuzzyMatchProduct(
  text: string,
  products: { id: string; name: string; sku_code?: string | null }[]
): { id: string; name: string } | null {
  const lower = text.toLowerCase();
  // 1. Exact SKU match
  for (const p of products) {
    if (p.sku_code && lower.includes(p.sku_code.toLowerCase())) {
      return { id: p.id, name: p.name };
    }
  }
  // 2. Full product name match
  for (const p of products) {
    if (lower.includes(p.name.toLowerCase())) {
      return { id: p.id, name: p.name };
    }
  }
  // 3. Word-overlap scoring (at least 2 words must match)
  let bestScore = 0;
  let bestProduct: { id: string; name: string } | null = null;
  for (const p of products) {
    const words = p.name.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
    const score = words.filter((w) => lower.includes(w)).length;
    if (score >= 2 && score > bestScore) {
      bestScore = score;
      bestProduct = { id: p.id, name: p.name };
    }
  }
  return bestProduct;
}

/** Parse quantity from message text */
function parseQuantity(text: string): number {
  const patterns = [
    /(\d+)\s*(?:box|boxes|carton|cartons|pcs|pieces|kg|packs?)/i,
    /(?:need|send|want|order)\s*(\d+)/i,
    /(\d+)\s+(?:of|nos?|units?)/i,
  ];
  for (const pat of patterns) {
    const m = text.match(pat);
    if (m) return parseInt(m[1], 10);
  }
  return 1; // default qty
}

serve(async (req) => {
  // GET = webhook verification (Click2API handshake)
  if (req.method === "GET") {
    return new Response("OK", { status: 200, headers: corsHeaders });
  }
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const payload = await req.json();
    console.log("Incoming WhatsApp webhook:", JSON.stringify(payload).substring(0, 800));

    // Guard: ignore outgoing/echo messages to prevent infinite loops
    const direction = payload?.direction || payload?.type || "";
    if (direction === "outgoing" || direction === "sent") {
      return new Response(JSON.stringify({ ok: true, skipped: "outgoing echo" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract sender & message from Click2API webhook format
    const senderPhone =
      payload?.from || payload?.sender || payload?.data?.from || payload?.contact?.wa_id || "";
    const messageBody =
      payload?.message || payload?.body || payload?.data?.body || payload?.text?.body || payload?.text || "";
    const messageType = payload?.messageType || payload?.type || payload?.data?.type || "text";

    // Extract media URL if present (image/document)
    const mediaUrl =
      payload?.mediaUrl ||
      payload?.media_url ||
      payload?.data?.media_url ||
      payload?.image?.url ||
      payload?.document?.url ||
      payload?.data?.image?.url ||
      null;
    const mediaMime =
      payload?.mediaMimeType ||
      payload?.media_mime_type ||
      payload?.image?.mime_type ||
      payload?.document?.mime_type ||
      "image/jpeg";

    if (!senderPhone && !mediaUrl) {
      return new Response(JSON.stringify({ ok: true, skipped: "no sender" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Phone Number Normalization & Client Matching ---
    const cleanPhone = normalizePhone(senderPhone);
    const { data: apps } = await supabaseAdmin
      .from("b2b_applications")
      .select("id, business_name, user_id, contact_phone, mobile_number")
      .or(`contact_phone.ilike.%${cleanPhone},mobile_number.ilike.%${cleanPhone}`)
      .eq("status", "approved")
      .limit(1);

    let companyId: string | null = null;
    let companyName = "Unknown";
    let accountManagerId: string | null = null;

    if (apps && apps.length > 0) {
      const app = apps[0];
      companyName = app.business_name;

      const { data: companies } = await supabaseAdmin
        .from("companies")
        .select("id, account_manager_id")
        .eq("business_name", app.business_name)
        .limit(1);

      if (companies && companies.length > 0) {
        companyId = companies[0].id;
        accountManagerId = companies[0].account_manager_id;
      }
    }

    // --- Media / Attachment Handling ---
    let attachmentUrl: string | null = null;
    if (mediaUrl) {
      try {
        const accessToken = Deno.env.get("CLICK2API_ACCESS_TOKEN");
        const mediaRes = await fetch(mediaUrl, {
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
        });

        if (mediaRes.ok) {
          const blob = await mediaRes.arrayBuffer();
          const ext = mediaMime.includes("pdf") ? "pdf" : mediaMime.includes("png") ? "png" : "jpg";
          const filePath = `${cleanPhone}/${Date.now()}.${ext}`;

          const { error: uploadErr } = await supabaseAdmin.storage
            .from("whatsapp_attachments")
            .upload(filePath, new Uint8Array(blob), {
              contentType: mediaMime,
              upsert: false,
            });

          if (!uploadErr) {
            const { data: urlData } = supabaseAdmin.storage
              .from("whatsapp_attachments")
              .getPublicUrl(filePath);
            attachmentUrl = urlData?.publicUrl || filePath;
          } else {
            console.error("Storage upload error:", uploadErr.message);
          }
        }
      } catch (mediaErr) {
        console.error("Media download failed:", mediaErr);
      }
    }

    // --- Log incoming message in CRM timeline ---
    const interactionNotes = [
      `[INCOMING]`,
      messageBody ? messageBody.substring(0, 1000) : "(media only)",
      attachmentUrl ? `\n📎 Attachment: ${attachmentUrl}` : "",
    ]
      .filter(Boolean)
      .join(" ");

    if (companyId) {
      await supabaseAdmin.from("client_interactions").insert({
        company_id: companyId,
        executive_id: null, // SYSTEM_AI
        interaction_type: "whatsapp",
        notes: interactionNotes,
        outcome: "received",
      });
    }

    // --- AI Order-Intent Detection with Fuzzy SKU Matching ---
    const orderKeywords = [
      "need", "order", "send", "want", "box", "boxes", "carton", "cartons",
      "kg", "pcs", "pieces", "rate", "price", "quote",
    ];
    const msgLower = (messageBody || "").toLowerCase();
    const hasOrderIntent = orderKeywords.some((kw) => msgLower.includes(kw));

    let draftOrderId: string | null = null;

    if (hasOrderIntent && companyId && messageBody) {
      // Fetch products for fuzzy matching
      const { data: allProducts } = await supabaseAdmin
        .from("products")
        .select("id, name, sku_code")
        .limit(500);

      const matchedProduct = allProducts ? fuzzyMatchProduct(messageBody, allProducts) : null;
      const parsedQty = parseQuantity(messageBody);

      // Create draft order
      const { data: draftOrder, error: orderErr } = await supabaseAdmin
        .from("orders")
        .insert({
          company_id: companyId,
          status: "draft",
          dispatch_urgency: "standard",
        })
        .select("id")
        .single();

      if (!orderErr && draftOrder) {
        draftOrderId = draftOrder.id;

        // If product matched, add as order item
        if (matchedProduct) {
          await supabaseAdmin.from("order_items").insert({
            order_id: draftOrder.id,
            product_id: matchedProduct.id,
            quantity: parsedQty,
            notes: `Auto-parsed from WhatsApp: "${messageBody.substring(0, 200)}"`,
          });
        }

        // Notify account manager (high priority)
        if (accountManagerId) {
          await supabaseAdmin.from("notifications").insert({
            user_id: accountManagerId,
            type: "whatsapp_order",
            message: `📱 New WhatsApp Draft Order for ${companyName}${matchedProduct ? ` — ${matchedProduct.name} × ${parsedQty}` : ""}. Review now. Message: "${messageBody.substring(0, 100)}"`,
            is_read: false,
          });
        }

        // Notify admins
        const { data: admins } = await supabaseAdmin
          .from("users")
          .select("id")
          .in("role", ["admin", "super_admin", "ADMIN", "SUPER_ADMIN"])
          .limit(5);

        for (const admin of admins || []) {
          if (admin.id === accountManagerId) continue; // avoid duplicate
          await supabaseAdmin.from("notifications").insert({
            user_id: admin.id,
            type: "whatsapp_order",
            message: `📱 WhatsApp Draft from ${companyName}: "${messageBody.substring(0, 100)}"`,
            is_read: false,
          });
        }

        // Log draft creation in CRM
        await supabaseAdmin.from("client_interactions").insert({
          company_id: companyId,
          executive_id: null,
          interaction_type: "whatsapp",
          notes: `[SYSTEM_AI] Draft order ${draftOrder.id.slice(0, 8)} auto-created.${matchedProduct ? ` Product: ${matchedProduct.name}, Qty: ${parsedQty}.` : " No SKU match — manual review required."}`,
          outcome: "draft_order_created",
        });
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        company: companyName,
        order_intent: hasOrderIntent,
        draft_order_id: draftOrderId,
        attachment: attachmentUrl,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unexpected error";
    console.error("whatsapp-webhook error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
