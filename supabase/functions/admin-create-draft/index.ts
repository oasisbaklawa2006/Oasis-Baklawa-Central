import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Verify caller is authenticated admin
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: "Invalid token" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Check admin role
  const { data: userData } = await supabaseAdmin
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = (userData?.role || "").toUpperCase();
  if (!["ADMIN", "SUPER_ADMIN"].includes(role)) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const { company_id, phone, sku_names, webhook_id } = body;

    if (!company_id && !phone) {
      return new Response(JSON.stringify({ error: "company_id or phone required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let resolvedCompanyId = company_id;

    // If no company_id, try to find or create by phone
    if (!resolvedCompanyId && phone) {
      const digits = phone.replace(/\D/g, "");
      const last10 = digits.slice(-10);

      const { data: companies } = await supabaseAdmin
        .from("companies")
        .select("id, business_name")
        .or(`phone.ilike.%${last10}%,gst_number.ilike.%${last10}%`)
        .limit(1);

      if (companies && companies.length > 0) {
        resolvedCompanyId = companies[0].id;
      } else {
        // Create shadow company
        const { data: newCompany, error: compErr } = await supabaseAdmin
          .from("companies")
          .insert({
            business_name: `WhatsApp Lead +${digits}`,
            phone: `+${digits}`,
            gst_number: `WA:${digits}`,
            status: "shadow",
          })
          .select("id")
          .single();

        if (compErr || !newCompany) {
          return new Response(JSON.stringify({ error: "Failed to create shadow client", detail: compErr?.message }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        resolvedCompanyId = newCompany.id;
      }
    }

    // Create draft order using service role (bypasses RLS)
    const { data: order, error: orderErr } = await supabaseAdmin
      .from("orders")
      .insert({
        company_id: resolvedCompanyId,
        status: "draft",
        dispatch_urgency: "standard",
      })
      .select("id")
      .single();

    if (orderErr || !order) {
      return new Response(JSON.stringify({ error: "Failed to create draft order", detail: orderErr?.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Try to match SKUs and insert order items
    if (sku_names && sku_names.length > 0) {
      const { data: products } = await supabaseAdmin
        .from("products")
        .select("id, name")
        .in("name", sku_names);

      if (products && products.length > 0) {
        const items = products.map((p: any) => ({
          order_id: order.id,
          product_id: p.id,
          quantity: 1,
        }));
        await supabaseAdmin.from("order_items").insert(items);
      }
    }

    // Mark webhook as processed if provided
    if (webhook_id) {
      await supabaseAdmin
        .from("debug_webhooks")
        .update({ processed: true })
        .eq("id", webhook_id);
    }

    return new Response(JSON.stringify({ ok: true, order_id: order.id }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unexpected error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
