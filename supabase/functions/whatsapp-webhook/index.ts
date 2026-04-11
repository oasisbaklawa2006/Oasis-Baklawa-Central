import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

/** Normalize phone: strip all non-digits, then get last 10 digits for DB matching */
function normalizePhone(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, "");
  return digits.slice(-10);
}

/** Fuzzy match a text fragment against product names */
function fuzzyMatchProduct(
  text: string,
  products: { id: string; name: string; sku_code?: string | null }[]
): { id: string; name: string } | null {
  const lower = text.toLowerCase();
  for (const p of products) {
    if (p.sku_code && lower.includes(p.sku_code.toLowerCase())) {
      return { id: p.id, name: p.name };
    }
  }
  for (const p of products) {
    if (lower.includes(p.name.toLowerCase())) {
      return { id: p.id, name: p.name };
    }
  }
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
  return 1;
}

serve(async (req) => {
  if (req.method === "GET") {
    return new Response("OK", { status: 200, headers: corsHeaders });
  }
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const payload = await req.json();
    console.log("Incoming WhatsApp webhook:", JSON.stringify(payload).substring(0, 800));

    // Extract sender & message from Click2API webhook format
    const senderPhone =
      payload?.from || payload?.sender || payload?.data?.from || payload?.contact?.wa_id || "";
    const messageBody =
      payload?.message || payload?.body || payload?.data?.body || payload?.text?.body || payload?.text || "";
    const messageType = payload?.messageType || payload?.type || payload?.data?.type || "text";

    // *** LOG RAW PAYLOAD to debug_webhooks ***
    await supabaseAdmin.from("debug_webhooks").insert({
      direction: "inbound",
      raw_payload: payload,
      phone_number: senderPhone || null,
      error_message: null,
      processed: false,
    });

    // Guard: ignore outgoing/echo messages
    const direction = payload?.direction || payload?.type || "";
    if (direction === "outgoing" || direction === "sent") {
      return new Response(JSON.stringify({ ok: true, skipped: "outgoing echo" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract media URL if present
    const mediaUrl =
      payload?.mediaUrl || payload?.media_url || payload?.data?.media_url ||
      payload?.image?.url || payload?.document?.url || payload?.data?.image?.url || null;
    const mediaMime =
      payload?.mediaMimeType || payload?.media_mime_type ||
      payload?.image?.mime_type || payload?.document?.mime_type || "image/jpeg";

    if (!senderPhone && !mediaUrl) {
      return new Response(JSON.stringify({ ok: true, skipped: "no sender" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Phone Number Normalization & Fuzzy Client Matching ---
    const last10 = normalizePhone(senderPhone);
    const digitsOnly = senderPhone.replace(/[^0-9]/g, "");

    // Search with multiple patterns: last 10 digits, full digits, with +
    const { data: apps } = await supabaseAdmin
      .from("b2b_applications")
      .select("id, business_name, user_id, contact_phone, mobile_number")
      .or(`contact_phone.ilike.%${last10},mobile_number.ilike.%${last10}`)
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
          const filePath = `${last10}/${Date.now()}.${ext}`;
          const { error: uploadErr } = await supabaseAdmin.storage
            .from("whatsapp_attachments")
            .upload(filePath, new Uint8Array(blob), { contentType: mediaMime, upsert: false });
          if (!uploadErr) {
            const { data: urlData } = supabaseAdmin.storage.from("whatsapp_attachments").getPublicUrl(filePath);
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
    ].filter(Boolean).join(" ");

    if (companyId) {
      await supabaseAdmin.from("client_interactions").insert({
        company_id: companyId,
        executive_id: null,
        interaction_type: "whatsapp",
        notes: interactionNotes,
        outcome: "received",
      });
    }

    // --- AI Order-Intent Detection ---
    const orderKeywords = [
      "need", "order", "send", "want", "box", "boxes", "carton", "cartons",
      "kg", "pcs", "pieces", "rate", "price", "quote",
    ];
    const msgLower = (messageBody || "").toLowerCase();
    const hasOrderIntent = orderKeywords.some((kw) => msgLower.includes(kw));

    let draftOrderId: string | null = null;

    if (hasOrderIntent && companyId && messageBody) {
      const { data: allProducts } = await supabaseAdmin
        .from("products")
        .select("id, name, sku_code")
        .limit(500);

      const matchedProduct = allProducts ? fuzzyMatchProduct(messageBody, allProducts) : null;
      const parsedQty = parseQuantity(messageBody);

      // Log if product NOT found
      if (!matchedProduct) {
        await supabaseAdmin.from("debug_webhooks").insert({
          direction: "inbound",
          raw_payload: { message: messageBody, sender: senderPhone },
          phone_number: senderPhone,
          error_message: `Product Not Found: ${messageBody.substring(0, 500)}`,
          processed: false,
        });
      }

      const { data: draftOrder, error: orderErr } = await supabaseAdmin
        .from("orders")
        .insert({ company_id: companyId, status: "draft", dispatch_urgency: "standard" })
        .select("id")
        .single();

      if (!orderErr && draftOrder) {
        draftOrderId = draftOrder.id;

        if (matchedProduct) {
          await supabaseAdmin.from("order_items").insert({
            order_id: draftOrder.id,
            product_id: matchedProduct.id,
            quantity: parsedQty,
            notes: `Auto-parsed from WhatsApp: "${messageBody.substring(0, 200)}"`,
          });
        }

        if (accountManagerId) {
          await supabaseAdmin.from("notifications").insert({
            user_id: accountManagerId,
            type: "whatsapp_order",
            message: `📱 New WhatsApp Draft Order for ${companyName}${matchedProduct ? ` — ${matchedProduct.name} × ${parsedQty}` : ""}. Review now. Message: "${messageBody.substring(0, 100)}"`,
            is_read: false,
          });
        }

        const { data: admins } = await supabaseAdmin
          .from("users")
          .select("id")
          .in("role", ["admin", "super_admin", "ADMIN", "SUPER_ADMIN"])
          .limit(5);

        for (const admin of admins || []) {
          if (admin.id === accountManagerId) continue;
          await supabaseAdmin.from("notifications").insert({
            user_id: admin.id,
            type: "whatsapp_order",
            message: `📱 WhatsApp Draft from ${companyName}: "${messageBody.substring(0, 100)}"`,
            is_read: false,
          });
        }

        await supabaseAdmin.from("client_interactions").insert({
          company_id: companyId,
          executive_id: null,
          interaction_type: "whatsapp",
          notes: `[SYSTEM_AI] Draft order ${draftOrder.id.slice(0, 8)} auto-created.${matchedProduct ? ` Product: ${matchedProduct.name}, Qty: ${parsedQty}.` : " No SKU match — manual review required."}`,
          outcome: "draft_order_created",
        });
      }
    }

    // Mark debug entry as processed
    // (update the last inserted debug row — best effort)

    return new Response(
      JSON.stringify({
        ok: true,
        company: companyName,
        order_intent: hasOrderIntent,
        draft_order_id: draftOrderId,
        attachment: attachmentUrl,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unexpected error";
    console.error("whatsapp-webhook error:", msg);

    // Log error to debug_webhooks
    await supabaseAdmin.from("debug_webhooks").insert({
      direction: "inbound",
      raw_payload: { error: msg },
      error_message: msg,
      processed: false,
    }).catch(() => {});

    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
