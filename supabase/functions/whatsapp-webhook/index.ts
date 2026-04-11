import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

/** Normalize phone: strip non-digits, return last 10 digits for Indian numbers */
function normalizePhone(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, "");
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

/** Full 91-prefixed phone for storage */
function to91(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  return digits;
}

/** Fuzzy match text fragment against product names/SKU */
function fuzzyMatchProduct(
  text: string,
  products: { id: string; name: string; sku_code?: string | null }[]
): { id: string; name: string } | null {
  const lower = text.toLowerCase();
  // Exact SKU match
  for (const p of products) {
    if (p.sku_code && lower.includes(p.sku_code.toLowerCase())) {
      return { id: p.id, name: p.name };
    }
  }
  // Full name substring
  for (const p of products) {
    if (lower.includes(p.name.toLowerCase())) {
      return { id: p.id, name: p.name };
    }
  }
  // Word-overlap scoring (≥2 words)
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

/**
 * Extract sender phone and message body from Click2API webhook payload.
 * Click2API may send different shapes — we handle all known variants.
 */
function extractPayloadFields(payload: any) {
  // Click2API Meta-style webhook
  const entry = payload?.entry?.[0]?.changes?.[0]?.value;
  if (entry) {
    const msg = entry?.messages?.[0];
    const contact = entry?.contacts?.[0];
    return {
      senderPhone: msg?.from || contact?.wa_id || "",
      messageBody: msg?.text?.body || msg?.caption || "",
      messageType: msg?.type || "text",
      mediaUrl: msg?.image?.url || msg?.document?.url || msg?.video?.url || null,
      mediaMime: msg?.image?.mime_type || msg?.document?.mime_type || "image/jpeg",
      messageId: msg?.id || null,
      profileName: contact?.profile?.name || null,
    };
  }

  // Direct Click2API format
  return {
    senderPhone: payload?.from || payload?.sender || payload?.data?.from || payload?.contact?.wa_id || payload?.waId || "",
    messageBody: payload?.message || payload?.body || payload?.data?.body || payload?.text?.body || payload?.text || "",
    messageType: payload?.messageType || payload?.type || payload?.data?.type || "text",
    mediaUrl: payload?.mediaUrl || payload?.media_url || payload?.data?.media_url ||
      payload?.image?.url || payload?.document?.url || payload?.data?.image?.url || null,
    mediaMime: payload?.mediaMimeType || payload?.media_mime_type ||
      payload?.image?.mime_type || payload?.document?.mime_type || "image/jpeg",
    messageId: payload?.messageId || payload?.id || null,
    profileName: payload?.pushName || payload?.profileName || payload?.contact?.name || null,
  };
}

serve(async (req) => {
  if (req.method === "GET") {
    const url = new URL(req.url);
    const verifyToken = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    const expectedVerifyToken = "OasisCentral2026";

    if (verifyToken === expectedVerifyToken && challenge) {
      return new Response(challenge, {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    }

    console.log(
      `Handshake Failed: Received Token [${verifyToken ?? ""}] expected [${expectedVerifyToken}]`
    );

    return new Response("Forbidden", {
      status: 403,
      headers: { "Content-Type": "text/plain" },
    });
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
    console.log("Incoming WhatsApp webhook:", JSON.stringify(payload).substring(0, 1000));

    const { senderPhone, messageBody, messageType, mediaUrl, mediaMime, messageId, profileName } =
      extractPayloadFields(payload);

    const last10 = normalizePhone(senderPhone);
    const phone91 = to91(senderPhone);

    // *** ALWAYS log raw payload to debug_webhooks ***
    await supabaseAdmin.from("debug_webhooks").insert({
      direction: "inbound",
      raw_payload: payload,
      phone_number: phone91 || senderPhone || null,
      error_message: null,
      processed: false,
    });

    // Guard: skip outgoing echoes or status updates
    const direction = payload?.direction || payload?.statuses ? "status" : "";
    if (direction === "outgoing" || direction === "sent" || direction === "status") {
      if (payload?.statuses) {
        console.log("Status update received, skipping:", JSON.stringify(payload.statuses).substring(0, 200));
      }
      return new Response(JSON.stringify({ ok: true, skipped: "outgoing/status" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!senderPhone && !mediaUrl) {
      return new Response(JSON.stringify({ ok: true, skipped: "no sender" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- PHONE → COMPANY MAPPING (multi-table fuzzy lookup) ---
    let companyId: string | null = null;
    let companyName = profileName || "Unknown";
    let accountManagerId: string | null = null;

    // Strategy 1: Match via b2b_applications (contact_phone / mobile_number)
    const { data: apps } = await supabaseAdmin
      .from("b2b_applications")
      .select("id, business_name, user_id, contact_phone, mobile_number")
      .or(`contact_phone.ilike.%${last10},mobile_number.ilike.%${last10}`)
      .eq("status", "approved")
      .limit(1);

    if (apps && apps.length > 0) {
      companyName = apps[0].business_name;
      const { data: companies } = await supabaseAdmin
        .from("companies")
        .select("id, account_manager_id")
        .eq("business_name", apps[0].business_name)
        .limit(1);
      if (companies && companies.length > 0) {
        companyId = companies[0].id;
        accountManagerId = companies[0].account_manager_id;
      }
    }

    // Strategy 2: Match via users table (phone / mobile_number → company_id)
    if (!companyId) {
      const { data: userMatch } = await supabaseAdmin
        .from("users")
        .select("id, company_id, name, full_name")
        .or(`phone.ilike.%${last10},mobile_number.ilike.%${last10}`)
        .limit(1);

      if (userMatch && userMatch.length > 0 && userMatch[0].company_id) {
        companyId = userMatch[0].company_id;
        const { data: comp } = await supabaseAdmin
          .from("companies")
          .select("business_name, account_manager_id")
          .eq("id", companyId)
          .single();
        if (comp) {
          companyName = comp.business_name;
          accountManagerId = comp.account_manager_id;
        }
      }
    }

    console.log(`Mapped phone ${phone91} → company: ${companyName} (${companyId}), manager: ${accountManagerId}`);

    // --- MEDIA / ATTACHMENT HANDLING ---
    let attachmentUrl: string | null = null;
    if (mediaUrl) {
      try {
        const apiKey = Deno.env.get("CLICK2API_API_KEY");
        const accessToken = Deno.env.get("CLICK2API_ACCESS_TOKEN");
        const mediaRes = await fetch(mediaUrl, {
          headers: {
            ...(apiKey ? { "apikey": apiKey } : {}),
            ...(accessToken ? { "Authorization": `Bearer ${accessToken}` } : {}),
          },
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
            console.log(`Media saved: ${attachmentUrl}`);
          } else {
            console.error("Storage upload error:", uploadErr.message);
          }
        } else {
          console.error(`Media download HTTP ${mediaRes.status}`);
          await mediaRes.text(); // consume body
        }
      } catch (mediaErr) {
        console.error("Media download failed:", mediaErr);
      }
    }

    // --- LOG INCOMING in CRM timeline ---
    const interactionNotes = [
      `[INCOMING]`,
      messageBody ? messageBody.substring(0, 1000) : "(media only)",
      attachmentUrl ? `\n📎 Attachment: ${attachmentUrl}` : "",
    ].filter(Boolean).join(" ");

    if (companyId) {
      await supabaseAdmin.from("client_interactions").insert({
        company_id: companyId,
        executive_id: accountManagerId,
        interaction_type: "whatsapp",
        notes: interactionNotes,
        outcome: "received",
      });
    }

    // --- AUTO-DRAFT ORDER BRAIN ---
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

      // Log if product NOT found for tuning
      if (!matchedProduct) {
        await supabaseAdmin.from("debug_webhooks").insert({
          direction: "inbound",
          raw_payload: { message: messageBody, sender: senderPhone, company: companyName },
          phone_number: phone91,
          error_message: `Product Not Found: ${messageBody.substring(0, 500)}`,
          processed: false,
        });
        console.log(`Product Not Found for: "${messageBody.substring(0, 100)}"`);
      }

      // Create DRAFT order
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

        // Notify Sales Executive
        if (accountManagerId) {
          await supabaseAdmin.from("notifications").insert({
            user_id: accountManagerId,
            type: "whatsapp_order",
            message: `📱 New WhatsApp Draft Order from ${companyName}${matchedProduct ? ` — ${matchedProduct.name} × ${parsedQty}` : ""}. Review now.`,
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
          if (admin.id === accountManagerId) continue;
          await supabaseAdmin.from("notifications").insert({
            user_id: admin.id,
            type: "whatsapp_order",
            message: `📱 WhatsApp Draft from ${companyName}: "${messageBody.substring(0, 100)}"`,
            is_read: false,
          });
        }

        // Log to CRM timeline
        await supabaseAdmin.from("client_interactions").insert({
          company_id: companyId,
          executive_id: accountManagerId,
          interaction_type: "whatsapp",
          notes: `[SYSTEM_AI] Draft order ${draftOrder.id.slice(0, 8)} auto-created.${matchedProduct ? ` Product: ${matchedProduct.name}, Qty: ${parsedQty}.` : " No SKU match — manual review required."}`,
          outcome: "draft_order_created",
        });
      } else if (orderErr) {
        console.error("Draft order creation failed:", orderErr.message);
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        company: companyName,
        company_id: companyId,
        order_intent: hasOrderIntent,
        draft_order_id: draftOrderId,
        attachment: attachmentUrl,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unexpected error";
    console.error("whatsapp-webhook error:", msg);

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
