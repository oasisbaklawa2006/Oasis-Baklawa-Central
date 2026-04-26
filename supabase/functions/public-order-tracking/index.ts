import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  if (!token || token.length < 10) {
    return new Response(JSON.stringify({ error: "Invalid tracking token" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .select(`
      id, status, created_at, estimated_despatch_date, actual_despatch_date,
      sales_order_value, tracking_number, courier_name,
      company:companies(business_name),
      order_items(quantity, product:products(name, image_url, pack_size))
    `)
    .eq("tracking_token", token)
    .single();

  if (error || !order) {
    return new Response(JSON.stringify({ error: "Order not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Return sanitized order data (no internal IDs exposed)
  const safeOrder = {
    order_ref: order.id.split("-")[0].toUpperCase(),
    status: order.status,
    created_at: order.created_at,
    estimated_dispatch: order.estimated_despatch_date,
    actual_dispatch: order.actual_despatch_date,
    tracking_number: order.tracking_number,
    courier: order.courier_name,
    company_name: (order.company as any)?.business_name || "—",
    items: ((order.order_items as any[]) || []).map((item: any) => ({
      name: item.product?.name || "Product",
      quantity: item.quantity,
      image_url: item.product?.image_url,
      pack_size: item.product?.pack_size,
    })),
  };

  return new Response(JSON.stringify(safeOrder), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
