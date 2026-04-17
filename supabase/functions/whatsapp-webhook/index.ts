import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const PORTAL_URL = "https://id-preview--a2649760-8f34-4dcf-aaf4-ff101ea06ef6.lovable.app";
const CTA_FOOTER = `\n\nPlease login to your B2B Portal to track your 10-point artisan journey:\n${PORTAL_URL}`;

// ── PHONE HELPERS ──
function normalizePhone(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, "");
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

function to91(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  return digits;
}

// ── SENDER CLASSIFICATION ──
async function classifySender(
  phone10: string,
  supabaseAdmin: any
): Promise<{ type: "staff" | "client" | "lead"; userId?: string; role?: string; name?: string; isSalesExec?: boolean }> {
  const { data: staffMatch } = await supabaseAdmin
    .from("users")
    .select("id, role, name, full_name, phone, mobile_number, is_sales_executive")
    .or(`phone.ilike.%${phone10},mobile_number.ilike.%${phone10}`)
    .limit(1);

  if (staffMatch && staffMatch.length > 0) {
    const user = staffMatch[0];
    const role = (user.role || "").toUpperCase();
    const isSalesExec = !!user.is_sales_executive;
    const staffRoles = [
      "SUPER_ADMIN", "ADMIN", "FINANCE_HEAD", "FINANCE_EXEC",
      "OPERATIONS_MANAGER", "PRODUCTION_MANAGER", "SALES_EXECUTIVE",
      "SUPPORT_EXECUTIVE", "DISPATCH_MANAGER", "STORE_INCHARGE",
    ];
    if (staffRoles.some((r) => role.includes(r)) || isSalesExec) {
      return { type: "staff", userId: user.id, role, name: user.full_name || user.name, isSalesExec };
    }
    return { type: "client", userId: user.id, name: user.full_name || user.name, isSalesExec };
  }
  return { type: "lead" };
}

// ── AI PRODUCT PARSING (Lovable AI Gateway) ──
async function aiParseOrder(
  messageBody: string,
  products: { id: string; name: string; sku?: string | null }[],
  aliases: { alias_text: string; canonical_name: string; product_id?: string | null }[]
): Promise<{
  items: { productId: string; productName: string; quantity: number; confidence: number }[];
  businessInfo: { name?: string; address?: string; gst?: string; city?: string } | null;
}> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) {
    console.log("LOVABLE_API_KEY not set, falling back to rule-based parsing");
    return { items: [], businessInfo: null };
  }

  const productList = products.slice(0, 100).map((p) => `${p.name} (SKU: ${p.sku || "N/A"})`).join("\n");
  const aliasList = aliases.slice(0, 50).map((a) => `"${a.alias_text}" → "${a.canonical_name}"`).join("\n");

  const prompt = `You are an order parser for Oasis Baklawa (a B2B wholesale bakery). Parse the following WhatsApp message into structured order items and business info.

PRODUCT CATALOG:
${productList}

KNOWN ALIASES:
${aliasList}

MESSAGE:
"${messageBody}"

Return JSON ONLY:
{
  "items": [{"product_name": "exact catalog name", "quantity": number, "confidence": 0.0-1.0}],
  "business_info": {"name": "if mentioned", "address": "if mentioned", "gst": "GST number if mentioned", "city": "if mentioned"} or null
}

Rules:
- Match misspelled/abbreviated product names to the closest catalog item
- Use aliases mapping when possible
- If quantity is unclear, default to 1 with confidence 0.5
- confidence: 1.0 = exact match, 0.7+ = high, 0.4-0.7 = medium, <0.4 = low
- Extract any business details (name, address, GST) from the message`;

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_tokens: 1000,
      }),
    });

    if (!res.ok) {
      console.error(`AI Gateway error: ${res.status}`);
      return { items: [], businessInfo: null };
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(content);

    const mappedItems = (parsed.items || []).map((item: any) => {
      const match = products.find(
        (p) => p.name.toLowerCase() === (item.product_name || "").toLowerCase()
      ) || products.find(
        (p) => p.name.toLowerCase().includes((item.product_name || "").toLowerCase())
      ) || products.find(
        (p) => (item.product_name || "").toLowerCase().includes(p.name.toLowerCase())
      );

      return match
        ? { productId: match.id, productName: match.name, quantity: item.quantity || 1, confidence: item.confidence || 0.5 }
        : null;
    }).filter(Boolean);

    return { items: mappedItems, businessInfo: parsed.business_info || null };
  } catch (e) {
    console.error("AI parse error:", e);
    return { items: [], businessInfo: null };
  }
}

// ── RULE-BASED FALLBACK ──
function aliasMatchProduct(
  text: string,
  products: { id: string; name: string; sku?: string | null }[],
  aliases: { alias_text: string; canonical_name: string; product_id?: string | null }[]
): { id: string; name: string } | null {
  const lower = text.toLowerCase();

  for (const alias of aliases) {
    if (lower.includes(alias.alias_text.toLowerCase())) {
      if (alias.product_id) {
        const p = products.find((pr) => pr.id === alias.product_id);
        if (p) return { id: p.id, name: p.name };
      }
      const p = products.find((pr) => pr.name.toLowerCase() === alias.canonical_name.toLowerCase());
      if (p) return { id: p.id, name: p.name };
      const partial = products.find((pr) => pr.name.toLowerCase().includes(alias.canonical_name.toLowerCase()));
      if (partial) return { id: partial.id, name: partial.name };
    }
  }

  for (const p of products) {
    if (p.sku && lower.includes(p.sku.toLowerCase())) return { id: p.id, name: p.name };
  }
  for (const p of products) {
    if (lower.includes(p.name.toLowerCase())) return { id: p.id, name: p.name };
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

// ── SEND WHATSAPP REPLY ──
async function sendReply(phone: string, message: string, supabaseAdmin: any, companyId?: string | null) {
  const apiKey = Deno.env.get("CLICK2API_API_KEY");
  const accessToken = Deno.env.get("CLICK2API_ACCESS_TOKEN");
  if (!apiKey) return;

  const fullMessage = message + CTA_FOOTER;

  const digits = phone.replace(/[^0-9]/g, "");
  const apiPhone = digits.length === 10 ? `91${digits}` : digits;

  try {
    const res = await fetch("https://crm.click2api.in/api/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": apiKey,
        ...(accessToken ? { "Authorization": `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: apiPhone,
        type: "text",
        text: { body: fullMessage },
      }),
    });
    console.log(`Reply sent to ${apiPhone}: ${res.status}`);

    await supabaseAdmin.from("debug_webhooks").insert({
      direction: "outbound",
      raw_payload: { to: apiPhone, message: fullMessage.substring(0, 500), status: res.status },
      phone_number: apiPhone,
      processed: res.ok,
    });

    if (companyId) {
      await supabaseAdmin.from("client_interactions").insert({
        company_id: companyId,
        interaction_type: "whatsapp",
        notes: `[AUTO_REPLY] ${fullMessage.substring(0, 500)}`,
        outcome: res.ok ? "delivered" : "failed",
      });
    }
  } catch (e) {
    console.error("Reply send error:", e);
  }
}

// ── GENERATE TEXT-BASED PI ──
function generateTextPI(orderId: string, companyName: string, items: { name: string; qty: number }[], totalEstimate: number): string {
  const soNum = orderId.split("-")[0].toUpperCase();
  const lines = [
    `PROFORMA INVOICE`,
    ``,
    `SO #: ${soNum}`,
    `Client: ${companyName}`,
    `Date: ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })}`,
    ``,
    `Items:`,
  ];

  items.forEach((item, i) => {
    lines.push(`${i + 1}. ${item.name} x ${item.qty}`);
  });

  lines.push(``);
  if (totalEstimate > 0) {
    const advance = Math.max(Math.round((totalEstimate * 0.2) / 1000) * 1000, 1000);
    lines.push(`Estimated Value: Rs. ${totalEstimate.toLocaleString("en-IN")}`);
    lines.push(`Advance Required (20%): Rs. ${advance.toLocaleString("en-IN")}`);
  } else {
    lines.push(`Pricing will be confirmed by your Sales Executive.`);
  }

  lines.push(``);
  lines.push(`Track your order: ${PORTAL_URL}/track?token=${orderId}`);
  lines.push(``);
  lines.push(`Status: Pre-Approved | Advance Unpaid`);
  lines.push(``);
  lines.push(`— Team Oasis Baklawa`);

  return lines.join("\n");
}

// ── PDF / DOCUMENT PARSING ──
async function parseDocumentForRepeatOrder(
  attachmentUrl: string,
  supabaseAdmin: any
): Promise<{ invoiceRef: string | null; items: { name: string; qty: number }[] }> {
  // Extract text from document using OCR / text extraction
  // For now, we attempt to read the document content from the stored payload
  const result: { invoiceRef: string | null; items: { name: string; qty: number }[] } = {
    invoiceRef: null,
    items: [],
  };

  try {
    // Check if the AI gateway can parse the document
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return result;

    const prompt = `You are a document parser for Oasis Baklawa. The customer has sent a previous invoice or purchase order document.

Extract the following from the document URL/reference: ${attachmentUrl}

Return JSON ONLY:
{
  "invoice_ref": "TCF/25-26/XXXX or similar reference number, or null",
  "items": [{"name": "product name as written", "qty": number}]
}

Look for:
- Invoice numbers in TCF/YY-YY/NNNN format
- Product names and quantities from line items
- Any SKU codes`;

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_tokens: 1000,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content || "{}";
      const parsed = JSON.parse(content);
      result.invoiceRef = parsed.invoice_ref || null;
      result.items = (parsed.items || []).map((i: any) => ({
        name: i.name || "",
        qty: i.qty || 1,
      }));
    }
  } catch (e) {
    console.error("Document parse error:", e);
  }

  return result;
}

// ── PAYLOAD EXTRACTION ──
function extractPayloadFields(payload: any) {
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

// ══════════════════════════════════════════════════
// MAIN HANDLER
// ══════════════════════════════════════════════════
serve(async (req) => {
  // ── GET HANDSHAKE ──
  if (req.method === "GET") {
    const url = new URL(req.url);
    const queryEntries = Array.from(url.searchParams.entries());
    console.log(`Handshake Query Params: ${JSON.stringify(queryEntries)}`);
    const challengeParamNames = ["challange", "challenge", "hub.challenge", "hub_challenge"];
    const tokenParamNames = ["echo", "hub.verify_token", "verify_token"];
    const challengeEntry = queryEntries.find(([key]) => challengeParamNames.includes(key.toLowerCase()));
    const tokenEntries = queryEntries.filter(([key]) => tokenParamNames.includes(key.toLowerCase()));
    if (tokenEntries.length > 0) {
      console.log(`Handshake Token Candidates: [${tokenEntries.map(([k, v]) => `${k}=${v}`).join(", ")}]`);
    }
    if (challengeEntry) {
      console.log(`Handshake Successful: Responding to [${challengeEntry[0]}] with value [${challengeEntry[1]}]`);
      return new Response(challengeEntry[1], { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8" } });
    }
    return new Response("Oasis OS Webhook Active", { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8" } });
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

    // Always log raw payload
    const { data: webhookRow } = await supabaseAdmin.from("debug_webhooks").insert({
      direction: "inbound",
      raw_payload: payload,
      phone_number: phone91 || senderPhone || null,
      error_message: null,
      processed: false,
    }).select("id").maybeSingle();

    // ── BANYAN BUFFER: stash this message for the Central Parser (60s debounce) ──
    if (last10 && (messageBody || mediaUrl)) {
      try {
        await supabaseAdmin.from("whatsapp_buffer").insert({
          sender_phone: last10,
          sender_name: profileName,
          message_type: messageType || "text",
          text_content: messageBody || null,
          media_url: mediaUrl,
          media_mime_type: mediaMime,
          raw_payload: payload,
          webhook_id: (webhookRow as any)?.id || null,
          bundle_status: "pending",
        });
      } catch (bufErr) {
        console.error("Buffer insert error:", bufErr);
      }
    }

    // ── LEDGER DISPUTE KEYWORD DETECTION ──
    // If a credit-client replies "request correction" / "ledger dispute" / "disputed",
    // open a dispute against their most recent sent ledger.
    try {
      const txt = (messageBody || "").toLowerCase().trim();
      const isDispute =
        txt.includes("request correction") ||
        txt.includes("ledger dispute") ||
        txt.includes("ledger correction") ||
        txt.includes("account mismatch") ||
        txt === "disputed" ||
        txt === "dispute";
      if (last10 && isDispute) {
        const { data: comp } = await supabaseAdmin
          .from("companies")
          .select("id, business_name")
          .or(`phone.ilike.%${last10}`)
          .limit(1)
          .maybeSingle();
        if (comp?.id) {
          const { data: latestLedger } = await supabaseAdmin
            .from("bi_monthly_ledgers")
            .select("id")
            .eq("company_id", comp.id)
            .order("generated_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (latestLedger?.id) {
            await supabaseAdmin.from("ledger_disputes").insert({
              ledger_id: latestLedger.id,
              company_id: comp.id,
              raised_via: "whatsapp",
              description: messageBody?.slice(0, 500) || null,
              status: "open",
            });
            await supabaseAdmin
              .from("bi_monthly_ledgers")
              .update({ status: "disputed" })
              .eq("id", latestLedger.id);
            // Soft acknowledgement
            const apiKey = Deno.env.get("CLICK2API_API_KEY");
            const accessToken = Deno.env.get("CLICK2API_ACCESS_TOKEN");
            if (apiKey) {
              await fetch("https://crm.click2api.in/api/v1/messages", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  apikey: apiKey,
                  ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
                },
                body: JSON.stringify({
                  messaging_product: "whatsapp",
                  to: phone91,
                  type: "text",
                  text: {
                    body:
                      `Thank you for flagging this. Our Finance team has been notified and will review your account together with you shortly.\n\n— Team Oasis Baklawa`,
                  },
                }),
              }).catch(() => {});
            }
          }
        }
      }
    } catch (dispErr) {
      console.error("Dispute keyword detection error:", dispErr);
    }

    // Guard: skip outgoing echoes or status updates
    const direction = payload?.direction || payload?.statuses ? "status" : "";
    if (direction === "outgoing" || direction === "sent" || direction === "status") {
      if (payload?.statuses) {
        console.log("Status update received, skipping:", JSON.stringify(payload.statuses).substring(0, 200));
      }
      return new Response(JSON.stringify({ ok: true, skipped: "outgoing/status" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!senderPhone && !mediaUrl) {
      return new Response(JSON.stringify({ ok: true, skipped: "no sender" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ══════════════════════════════════════════
    // PART 1: SENDER CLASSIFICATION
    // ══════════════════════════════════════════
    const sender = await classifySender(last10, supabaseAdmin);
    console.log(`Sender classified: ${sender.type} (${sender.name || "unknown"}) phone=${phone91}, isSalesExec=${sender.isSalesExec}`);

    // ── PHONE → COMPANY MAPPING ──
    let companyId: string | null = null;
    let companyName = profileName || "Unknown";
    let accountManagerId: string | null = null;
    let isShadowClient = false;

    const senderIsSalesExec = sender.type === "staff" && sender.isSalesExec && sender.userId;

    // ── STAFF SENDER RE-WIRE ──
    if (senderIsSalesExec && messageBody) {
      const clientPatterns = [
        /(?:order\s+for|client|customer|party|for\s+M\/s\.?|for)\s+[:\-]?\s*([A-Z][A-Za-z\s&'.]+)/i,
        /([A-Z][A-Za-z\s&'.]{3,})\s+(?:ka|ke|ki|order|wants?|need)/i,
      ];
      let mentionedClient: string | null = null;
      for (const pat of clientPatterns) {
        const m = messageBody.match(pat);
        if (m) { mentionedClient = m[1].trim(); break; }
      }

      if (mentionedClient) {
        const { data: clientMatch } = await supabaseAdmin
          .from("companies")
          .select("id, business_name, account_manager_id")
          .ilike("business_name", `%${mentionedClient}%`)
          .limit(1);

        if (clientMatch && clientMatch.length > 0) {
          companyId = clientMatch[0].id;
          companyName = clientMatch[0].business_name;
          accountManagerId = sender.userId!;
          if (!clientMatch[0].account_manager_id) {
            await supabaseAdmin.from("companies")
              .update({ account_manager_id: sender.userId })
              .eq("id", companyId);
          }
          console.log(`Staff re-wire: ${sender.name} -> order for client "${companyName}" (${companyId})`);
        }
      }
    }

    // Strategy 1: Match via b2b_applications
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

    // Strategy 2: Match via users table
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

    // Strategy 3: Check companies by phone pattern
    if (!companyId) {
      const { data: phoneMatch } = await supabaseAdmin
        .from("companies")
        .select("id, business_name, account_manager_id, status")
        .ilike("gst_number", `%${last10}%`)
        .order("status", { ascending: true })
        .limit(1);

      if (phoneMatch && phoneMatch.length > 0) {
        companyId = phoneMatch[0].id;
        companyName = phoneMatch[0].business_name;
        accountManagerId = phoneMatch[0].account_manager_id;
        isShadowClient = phoneMatch[0].status === "shadow";
      }
    }

    // Strategy 4: SHADOW CLIENT CREATION
    const orderKeywords = [
      "need", "order", "send", "want", "box", "boxes", "carton", "cartons",
      "kg", "pcs", "pieces", "rate", "price", "quote",
    ];
    const msgLower = (messageBody || "").toLowerCase();
    const hasOrderIntent = orderKeywords.some((kw) => msgLower.includes(kw));

    if (!companyId && senderPhone) {
      const shadowName = profileName ? `${profileName} (WhatsApp)` : `WhatsApp Lead ${phone91}`;

      const { data: newCompany, error: compErr } = await supabaseAdmin
        .from("companies")
        .insert({
          business_name: shadowName,
          status: "shadow",
          gst_number: `WA:${phone91}`,
          price_tier: "B2B",
        })
        .select("id")
        .single();

      if (!compErr && newCompany) {
        companyId = newCompany.id;
        companyName = shadowName;
        isShadowClient = true;
        console.log(`Shadow client created: ${shadowName} (${companyId})`);

        const { data: admins } = await supabaseAdmin
          .from("users").select("id")
          .in("role", ["admin", "super_admin", "ADMIN", "SUPER_ADMIN"])
          .limit(5);
        for (const admin of admins || []) {
          await supabaseAdmin.from("notifications").insert({
            user_id: admin.id,
            type: "shadow_client",
            message: `New Shadow Client: ${shadowName} (${phone91}). Verify and onboard in the Verification War Room.`,
            is_read: false,
          });
        }
      }
    }

    // If sender is a sales exec, assign them as account manager
    if (senderIsSalesExec && companyId && !accountManagerId) {
      accountManagerId = sender.userId!;
      await supabaseAdmin.from("companies")
        .update({ account_manager_id: sender.userId })
        .eq("id", companyId);
      console.log(`Auto-assigned ${sender.name} as account manager for company ${companyId}`);
    }

    console.log(`Mapped phone ${phone91} -> company: ${companyName} (${companyId}), shadow: ${isShadowClient}, sender: ${sender.type}, salesExec: ${senderIsSalesExec}`);

    // ── MEDIA / ATTACHMENT HANDLING ──
    let attachmentUrl: string | null = null;
    let documentParseResult: { invoiceRef: string | null; items: { name: string; qty: number }[] } | null = null;

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
          }

          // If it's a document (PDF), attempt to parse for repeat order
          if (messageType === "document" || mediaMime.includes("pdf")) {
            documentParseResult = await parseDocumentForRepeatOrder(attachmentUrl || filePath, supabaseAdmin);
            if (documentParseResult.invoiceRef) {
              console.log(`Document parsed: Invoice Ref ${documentParseResult.invoiceRef}, Items: ${documentParseResult.items.length}`);
            }
          }
        } else {
          await mediaRes.text();
        }
      } catch (mediaErr) {
        console.error("Media download failed:", mediaErr);
      }
    }

    // ── LOG INCOMING in CRM timeline ──
    const interactionNotes = [
      `[INCOMING${sender.type === "staff" ? " - STAFF: " + sender.name : ""}]`,
      messageBody ? messageBody.substring(0, 1000) : "(media only)",
      attachmentUrl ? `\nAttachment: ${attachmentUrl}` : "",
      isShadowClient ? `\nShadow Client - pending verification` : "",
      documentParseResult?.invoiceRef ? `\nRepeat Order Ref: ${documentParseResult.invoiceRef}` : "",
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

    // ══════════════════════════════════════════
    // PART 2 & 3: AI ORDER PARSING + CLIENT INFO
    // ══════════════════════════════════════════
    let draftOrderId: string | null = null;
    let piSent = false;

    if (hasOrderIntent && companyId && messageBody) {
      const { data: allProducts } = await supabaseAdmin
        .from("products")
        .select("id, name, sku, base_price, price_b2b, price_wholesale, wholesale_price, price_per_kg")
        .limit(500);

      const { data: aliasRows } = await supabaseAdmin
        .from("product_aliases")
        .select("alias_text, canonical_name, product_id")
        .limit(200);

      const products = allProducts || [];
      const aliases = aliasRows || [];

      console.log(`Products loaded: ${products.length}, Aliases loaded: ${aliases.length}`);
      const aiResult = await aiParseOrder(messageBody, products, aliases);
      let orderItems: { productId: string; productName: string; quantity: number; confidence: number }[] = aiResult.items;

      if (orderItems.length === 0) {
        const matched = aliasMatchProduct(messageBody, products, aliases);
        const qty = parseQuantity(messageBody);
        console.log(`Rule-based match: ${matched ? matched.name : "NONE"}, qty: ${qty}`);
        if (matched) {
          orderItems = [{ productId: matched.id, productName: matched.name, quantity: qty, confidence: 0.7 }];
        }
      }

      // Merge document-parsed items if available
      if (documentParseResult && documentParseResult.items.length > 0) {
        for (const docItem of documentParseResult.items) {
          const matched = aliasMatchProduct(docItem.name, products, aliases);
          if (matched && !orderItems.find((oi) => oi.productId === matched.id)) {
            orderItems.push({
              productId: matched.id,
              productName: matched.name,
              quantity: docItem.qty,
              confidence: 0.8,
            });
          }
        }
      }

      console.log(`Order items resolved: ${orderItems.length}`);

      // ── PART 3: AUTO-FILL SHADOW DATA ──
      if (isShadowClient && companyId) {
        const bizInfo = aiResult.businessInfo;
        if (bizInfo) {
          const updates: Record<string, any> = {};
          if (bizInfo.name) updates.business_name = bizInfo.name;
          if (bizInfo.gst && /\d{2}[A-Z]{5}\d{4}[A-Z]{1}\d{1}[A-Z]{1}\d{1}/.test(bizInfo.gst)) {
            updates.gst_number = bizInfo.gst;
          }
          if (bizInfo.address) updates.website = bizInfo.address;
          if (Object.keys(updates).length > 0) {
            await supabaseAdmin.from("companies").update(updates).eq("id", companyId);
            console.log(`Shadow data auto-filled: ${JSON.stringify(updates)}`);
          }
        }
        if (profileName && !aiResult.businessInfo?.name) {
          await supabaseAdmin.from("companies")
            .update({ business_name: `${profileName} (WhatsApp)` })
            .eq("id", companyId)
            .eq("business_name", `WhatsApp Lead ${phone91}`);
        }
      }

      // ══════════════════════════════════════════
      // CLARIFICATION LOOP — Low confidence items
      // ══════════════════════════════════════════
      const lowConfidenceItems = orderItems.filter((i) => i.confidence < 0.6);
      const highConfidenceItems = orderItems.filter((i) => i.confidence >= 0.6);

      if (lowConfidenceItems.length > 0) {
        const clarificationLines = lowConfidenceItems.map(
          (i) => `- "${i.productName}" x ${i.quantity}`
        );
        const clarifyMsg = [
          `Greetings from Oasis Baklawa.`,
          ``,
          `Thank you for your order. We noticed a request for the following items and would like to confirm the specific variant or quantity:`,
          ``,
          ...clarificationLines,
          ``,
          `Please reply with corrections or simply confirm "Confirmed" to proceed.`,
        ].join("\n");

        await sendReply(phone91, clarifyMsg, supabaseAdmin, companyId);
        console.log(`Clarification sent for ${lowConfidenceItems.length} low-confidence items`);
      }

      // ── CREATE DRAFT ORDER ──
      if (orderItems.length > 0 || hasOrderIntent) {
        console.log(`Creating draft order for ${companyId}, items: ${orderItems.length}`);
        const { data: draftOrder, error: orderErr } = await supabaseAdmin
          .from("orders")
          .insert({
            company_id: companyId,
            status: "draft",
            dispatch_urgency: "standard",
            payment_status: "awaiting_advance",
          })
          .select("id")
          .single();

        console.log(`Draft result: ${JSON.stringify(draftOrder)}, err: ${orderErr?.message || "none"}`);
        if (!orderErr && draftOrder) {
          draftOrderId = draftOrder.id;

          let estimatedTotal = 0;
          const piItems: { name: string; qty: number }[] = [];

          for (const item of orderItems) {
            await supabaseAdmin.from("order_items").insert({
              order_id: draftOrder.id,
              product_id: item.productId,
              quantity: item.quantity,
              notes: `WhatsApp AI (confidence: ${(item.confidence * 100).toFixed(0)}%): "${messageBody.substring(0, 200)}"`,
            });

            const prod = products.find((p) => p.id === item.productId);
            if (prod) {
              const price = prod.price_b2b || prod.base_price || prod.price_per_kg || prod.wholesale_price || prod.price_wholesale || 0;
              estimatedTotal += price * item.quantity;
            }
            piItems.push({ name: item.productName, qty: item.quantity });
          }

          if (orderItems.length === 0) {
            await supabaseAdmin.from("debug_webhooks").insert({
              direction: "inbound",
              raw_payload: { message: messageBody, sender: senderPhone, company: companyName },
              phone_number: phone91,
              error_message: `No SKU Match: ${messageBody.substring(0, 500)}`,
              processed: false,
            });
          }

          const totalWithGst = Math.round(estimatedTotal * 1.18);
          const advanceRequired = Math.max(Math.round((totalWithGst * 0.2) / 1000) * 1000, 1000);

          await supabaseAdmin.from("orders").update({
            sales_order_value: totalWithGst,
            advance_required: advanceRequired,
          }).eq("id", draftOrder.id);

          // ── FINANCE: Auto SO/PI + WhatsApp delivery ──
          if (piItems.length > 0) {
            const piText = generateTextPI(draftOrder.id, companyName, piItems, totalWithGst);
            await sendReply(phone91, piText, supabaseAdmin, companyId);
            piSent = true;
            console.log(`PI sent to ${phone91} for order ${draftOrder.id}`);
          } else {
            const itemsList = piItems.map((i) => `${i.name} x ${i.qty}`).join(", ");
            const ackMsg = [
              `Greetings from Oasis Baklawa.`,
              ``,
              `We have received your order request and our team will review it shortly.`,
              ``,
              `Your order reference: SO #${draftOrder.id.split("-")[0].toUpperCase()}`,
            ].join("\n");
            await sendReply(phone91, ackMsg, supabaseAdmin, companyId);
          }

          // Notify Sales Executive
          if (accountManagerId) {
            await supabaseAdmin.from("notifications").insert({
              user_id: accountManagerId,
              type: "whatsapp_order",
              message: `New WhatsApp Draft Order from ${companyName}${piItems.length > 0 ? ` - ${piItems.map((i) => `${i.name} x ${i.qty}`).join(", ")}` : ""}. Review now.`,
              is_read: false,
            });
          }

          // Notify admins
          const { data: admins } = await supabaseAdmin
            .from("users").select("id")
            .in("role", ["admin", "super_admin", "ADMIN", "SUPER_ADMIN"])
            .limit(5);
          for (const admin of admins || []) {
            if (admin.id === accountManagerId) continue;
            await supabaseAdmin.from("notifications").insert({
              user_id: admin.id,
              type: "whatsapp_order",
              message: `WhatsApp Draft from ${companyName}: "${messageBody.substring(0, 100)}"`,
              is_read: false,
            });
          }

          // Log to CRM timeline
          await supabaseAdmin.from("client_interactions").insert({
            company_id: companyId,
            executive_id: accountManagerId,
            interaction_type: "whatsapp",
            notes: `[SYSTEM_AI] Draft order ${draftOrder.id.slice(0, 8)} auto-created. ${piItems.length > 0 ? `Items: ${piItems.map((i) => `${i.name} x ${i.qty}`).join(", ")}.` : "No SKU match - manual review."} ${isShadowClient ? "Shadow client." : ""} ${piSent ? "PI sent via WhatsApp." : ""}`,
            outcome: "draft_order_created",
          });
        }
      }
    } else if (messageBody && companyId && !hasOrderIntent) {
      const ackMsg = [
        `Greetings from Oasis Baklawa.`,
        ``,
        `Thank you for reaching out${profileName ? ", " + profileName : ""}. Our team will get back to you shortly.`,
      ].join("\n");
      await sendReply(phone91, ackMsg, supabaseAdmin, companyId);
    }

    // ── DRAFT CLEANUP: Auto-archive stale drafts ──
    const cutoff48h = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const { data: staleDrafts } = await supabaseAdmin
      .from("orders")
      .select("id")
      .eq("status", "draft")
      .lte("sales_order_value", 0)
      .lt("created_at", cutoff48h)
      .limit(50);

    if (staleDrafts && staleDrafts.length > 0) {
      const staleIds = staleDrafts.map((d: any) => d.id);
      await supabaseAdmin.from("orders").update({ status: "cancelled" }).in("id", staleIds);
      console.log(`Archived ${staleIds.length} stale draft orders`);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        company: companyName,
        company_id: companyId,
        sender_type: sender.type,
        order_intent: hasOrderIntent,
        draft_order_id: draftOrderId,
        pi_sent: piSent,
        attachment: attachmentUrl,
        shadow_client: isShadowClient,
        document_parsed: !!documentParseResult?.invoiceRef,
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
