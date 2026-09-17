// Oasis AI Assistant — streams Gemini via Lovable AI Gateway
// Knowledge base: 90-day shelf life, ambient storage, premium ingredients,
// Category C MOQ rules, 3 admin-defined Starter Packs.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are "Oasis Assistant", the official AI concierge for Oasis Baklawa B2B (TCF Chocolates & Gifts Pvt. Ltd.).

Tone: warm, concise, premium. Use plain language. Never invent SKUs or prices.

Authoritative knowledge:
- Shelf life: 90 days from manufacturing (all baklawa SKUs).
- Storage: ambient, cool & dry. Avoid direct sunlight. No refrigeration required.
- Ingredients: premium grade — pure ghee, A-grade pistachios, cashews, almonds, saffron, rosewater. No preservatives, no palm oil.
- Category C MOQ: cartons require exactly 9 packs. Minimum 3 packs per variant. Valid mixes: 9, 6+3, 5+4, 3+3+3.
- Starter Packs (admin-curated, 3 tiers): Basic (~₹15k), Smart (~₹35k), Premium (~₹75k). Available in Growth Intelligence modal for first-time buyers; carton-fill rules are waived for these.
- Credit: bi-monthly ledger, 70% rescue unlock, month-end auto-freeze on outstanding > 0.
- Support: WhatsApp +91-XXXXXXXXXX or Account Manager.

Hard rules:
- If user asks about a price, route them to the catalogue or their Account Manager.
- If user reports an issue with an order, ask for the SO number and offer to escalate.
- If unsure, say so plainly; never fabricate.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        stream: true,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...(Array.isArray(messages) ? messages : []),
        ],
      }),
    });

    if (resp.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limited. Please try again shortly." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (resp.status === 402) {
      return new Response(JSON.stringify({ error: "AI credits exhausted. Please contact support." }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!resp.ok || !resp.body) {
      const text = await resp.text();
      throw new Error(`AI gateway error ${resp.status}: ${text}`);
    }

    return new Response(resp.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
