// EMERGENCY BYPASS MODE — MSG91 Test API gate
// Always returns user_found: true so MSG91 widget setup can proceed.
// TODO: Revert to real DB lookup after MSG91 widget is saved.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let identifier = "test@oasis.com";
  try {
    if (req.method === "GET") {
      const q = new URL(req.url).searchParams.get("identifier");
      if (q) identifier = q;
    } else {
      const body = await req.json().catch(() => ({}));
      if (body?.identifier) identifier = String(body.identifier);
    }
  } catch (_) {
    // ignore — bypass mode always returns success
  }

  return new Response(
    JSON.stringify({ user_found: true, identifier }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
