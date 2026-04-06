import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { productName, description, category } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are a food industry product data specialist for an Indian B2B sweets & bakery company (TCF Chocolates & Gifts). Given a product name, description, and category, generate accurate:

1. NUTRITION TABLE: FSSAI-compliant per 100g nutrition facts (Energy kcal, Protein g, Total Fat g, Saturated Fat g, Carbohydrates g, Total Sugars g, Added Sugars g, Sodium mg). Use realistic values for Indian sweets/bakery/nuts.

2. ALLERGEN ALERTS: List applicable allergens from: Tree Nuts, Peanuts, Milk/Dairy, Wheat/Gluten, Soy, Eggs, Sesame. Be accurate based on the product type.

3. HSN CODE: The correct Indian GST HSN code for this product type.

4. GST RATE: The correct GST percentage (0, 5, 12, 18, or 28) for this product category under Indian GST law.

5. INGREDIENTS: A realistic ingredients list for this product type, listed in descending order of proportion.`;

    const userPrompt = `Product Name: ${productName}
Description: ${description || "Not provided"}
Category: ${category || "Not provided"}

Generate the product attributes.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "set_product_attributes",
              description: "Set the generated product attributes",
              parameters: {
                type: "object",
                properties: {
                  nutrition_facts: {
                    type: "string",
                    description: "FSSAI nutrition table as formatted text per 100g",
                  },
                  allergen_warnings: {
                    type: "string",
                    description: "Comma-separated allergen alerts e.g. 'Contains: Tree Nuts, Milk/Dairy, Wheat/Gluten'",
                  },
                  hsn_code: {
                    type: "string",
                    description: "Indian GST HSN code e.g. '19059090'",
                  },
                  gst_percentage: {
                    type: "number",
                    description: "GST rate: 0, 5, 12, 18, or 28",
                  },
                  ingredients: {
                    type: "string",
                    description: "Ingredients list in descending order of proportion",
                  },
                },
                required: ["nutrition_facts", "allergen_warnings", "hsn_code", "gst_percentage", "ingredients"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "set_product_attributes" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in response");

    const attributes = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(attributes), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-product-attributes error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
