import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

function generateHexToken(bytes = 16): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

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
    const {
      company_id,
      phone,
      sku_names,
      webhook_ids,
      // Company activation fields (optional)
      activate_company,
      company_update,
      // WhatsApp notification (optional)
      send_whatsapp_to,
      whatsapp_message,
    } = body;

    if (!company_id && !phone) {
      return new Response(JSON.stringify({ error: "company_id or phone required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let resolvedCompanyId = company_id;

    // --- STEP 1: Resolve or create company ---
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

    // --- STEP 2: Activate / update company if requested ---
    if (activate_company && resolvedCompanyId) {
      const updatePayload: Record<string, any> = { status: "active" };
      if (company_update) {
        if (company_update.business_name) updatePayload.business_name = company_update.business_name;
        if (company_update.gst_number !== undefined) updatePayload.gst_number = company_update.gst_number || null;
        if (company_update.fssai_number !== undefined) updatePayload.fssai_number = company_update.fssai_number || null;
        if (company_update.registered_address !== undefined) updatePayload.registered_address = company_update.registered_address || null;
      }

      const { error: updateErr } = await supabaseAdmin
        .from("companies")
        .update(updatePayload)
        .eq("id", resolvedCompanyId);

      if (updateErr) {
        return new Response(JSON.stringify({ error: "Company activation failed", detail: updateErr.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Hard-verify the update landed
      const { data: verifyRow } = await supabaseAdmin
        .from("companies")
        .select("status")
        .eq("id", resolvedCompanyId)
        .single();

      if (verifyRow?.status !== "active") {
        return new Response(JSON.stringify({ error: "Company activation not confirmed in DB" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // --- STEP 3: Create draft order with tracking token (bypass trigger) ---
    const { data: order, error: orderErr } = await supabaseAdmin
      .from("orders")
      .insert({
        company_id: resolvedCompanyId,
        status: "draft",
        dispatch_urgency: "standard",
        tracking_token: generateHexToken(16),
      })
      .select("id")
      .single();

    if (orderErr || !order) {
      return new Response(JSON.stringify({ error: "Failed to create draft order", detail: orderErr?.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- STEP 4: Match SKUs and insert order items atomically ---
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
        const { error: itemsErr } = await supabaseAdmin.from("order_items").insert(items);

        if (itemsErr) {
          // Rollback: delete the shell order
          await supabaseAdmin.from("orders").delete().eq("id", order.id);
          return new Response(JSON.stringify({ error: "Failed to insert order items — order rolled back", detail: itemsErr.message }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    // --- STEP 5: Mark webhooks as processed ---
    if (webhook_ids && webhook_ids.length > 0) {
      await supabaseAdmin
        .from("debug_webhooks")
        .update({ processed: true })
        .in("id", webhook_ids);
    }

    // --- STEP 6: Send WhatsApp notification if requested ---
    if (send_whatsapp_to && whatsapp_message) {
      try {
        const waUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-whatsapp`;
        await fetch(waUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({
            to: send_whatsapp_to,
            message: whatsapp_message,
            company_id: resolvedCompanyId,
            order_id: order.id,
          }),
        });
      } catch (waErr) {
        console.error("WhatsApp send failed (non-blocking):", waErr);
      }
    }

    return new Response(JSON.stringify({ ok: true, order_id: order.id, company_id: resolvedCompanyId }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unexpected error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
