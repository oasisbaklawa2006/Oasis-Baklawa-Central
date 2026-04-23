// Generate Bi-Monthly Ledger
// - Aggregates orders for credit clients over a 15-day window
// - Renders a soft-tone PDF ledger via pdf-lib
// - Uploads to final-invoices bucket and sends to client WhatsApp
// Invocation:
//   POST { company_id?, period_start?, period_end? }
//   - No body / cron call → runs for ALL credit clients, last 15 days
//   - company_id only      → runs for that client, last 15 days
//   - period_start/end     → custom window
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const PORTAL_URL = "https://b2b.oasisbaklawa.com";

function to91(raw: string): string {
  const d = (raw || "").replace(/\D/g, "");
  if (d.length === 10) return `91${d}`;
  if (d.length === 12 && d.startsWith("91")) return d;
  return d;
}

function fmtINR(n: number): string {
  return "Rs. " + (n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function fmtDate(s: string | null): string {
  if (!s) return "-";
  const d = new Date(s);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

async function buildLedgerPdf(args: {
  businessName: string;
  periodStart: string;
  periodEnd: string;
  rows: { date: string; orderRef: string; status: string; amount: number }[];
  total: number;
}): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]); // A4
  const helv = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helvBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const champagne = rgb(0.72, 0.52, 0.04);
  const ink = rgb(0.13, 0.16, 0.22);
  const mute = rgb(0.45, 0.49, 0.55);
  const line = rgb(0.85, 0.87, 0.91);

  // Header
  page.drawText("OASIS BAKLAWA", { x: 40, y: 790, size: 18, font: helvBold, color: ink });
  page.drawText("Bi-Monthly Account Statement", { x: 40, y: 770, size: 11, font: helv, color: mute });
  page.drawText("Account Statement", { x: 400, y: 790, size: 12, font: helvBold, color: champagne });
  page.drawText(`Period: ${fmtDate(args.periodStart)} - ${fmtDate(args.periodEnd)}`, {
    x: 400, y: 772, size: 9, font: helv, color: mute,
  });

  page.drawLine({ start: { x: 40, y: 755 }, end: { x: 555, y: 755 }, thickness: 1, color: champagne });

  // Client block
  page.drawText("BILLED TO", { x: 40, y: 730, size: 8, font: helvBold, color: mute });
  page.drawText(args.businessName, { x: 40, y: 712, size: 13, font: helvBold, color: ink });

  // Soft note
  const note =
    "We have shared this gentle account summary for your kind reconciliation. If everything aligns,";
  const note2 = "no action is needed. If you spot any discrepancy, kindly reply 'Request Correction' on WhatsApp.";
  page.drawText(note, { x: 40, y: 685, size: 9, font: helv, color: mute });
  page.drawText(note2, { x: 40, y: 672, size: 9, font: helv, color: mute });

  // Table header
  let y = 640;
  page.drawRectangle({ x: 40, y: y - 4, width: 515, height: 22, color: rgb(0.96, 0.97, 0.99) });
  page.drawText("DATE", { x: 50, y: y + 4, size: 9, font: helvBold, color: ink });
  page.drawText("ORDER REF", { x: 145, y: y + 4, size: 9, font: helvBold, color: ink });
  page.drawText("STATUS", { x: 305, y: y + 4, size: 9, font: helvBold, color: ink });
  page.drawText("AMOUNT", { x: 480, y: y + 4, size: 9, font: helvBold, color: ink });
  y -= 28;

  for (const r of args.rows) {
    if (y < 80) {
      page.drawText("(continued on next page)", { x: 40, y: 60, size: 8, font: helv, color: mute });
      break;
    }
    page.drawText(fmtDate(r.date), { x: 50, y, size: 9, font: helv, color: ink });
    page.drawText(r.orderRef, { x: 145, y, size: 9, font: helv, color: ink });
    page.drawText(r.status, { x: 305, y, size: 9, font: helv, color: mute });
    page.drawText(fmtINR(r.amount), { x: 480, y, size: 9, font: helvBold, color: ink });
    y -= 16;
    page.drawLine({ start: { x: 40, y: y + 8 }, end: { x: 555, y: y + 8 }, thickness: 0.3, color: line });
  }

  if (args.rows.length === 0) {
    page.drawText("No orders in this period.", { x: 50, y, size: 10, font: helv, color: mute });
    y -= 20;
  }

  // Total
  y -= 10;
  page.drawLine({ start: { x: 40, y: y + 6 }, end: { x: 555, y: y + 6 }, thickness: 1, color: champagne });
  page.drawText("TOTAL OUTSTANDING (FOR PERIOD)", { x: 50, y: y - 12, size: 10, font: helvBold, color: ink });
  page.drawText(fmtINR(args.total), { x: 460, y: y - 12, size: 12, font: helvBold, color: champagne });

  // Footer
  page.drawText("Thank you for your continued partnership with Oasis Baklawa.", {
    x: 40, y: 50, size: 9, font: helv, color: mute,
  });
  page.drawText(PORTAL_URL, { x: 40, y: 36, size: 8, font: helv, color: champagne });

  return await pdfDoc.save();
}

async function sendWhatsAppPdf(phone: string, businessName: string, pdfPublicUrl: string) {
  const apiKey = Deno.env.get("CLICK2API_API_KEY");
  if (!apiKey) return null;
  const accessToken = Deno.env.get("CLICK2API_ACCESS_TOKEN");
  const apiPhone = to91(phone);
  const greeting = `Dear ${businessName},`;
  const body =
    `${greeting}\n\n` +
    `As part of our gentle bi-monthly reconciliation, here is your account statement for the last 15 days.\n\n` +
    `Kindly review at your convenience. If everything matches, no reply is needed.\n` +
    `If something seems off, simply reply *Request Correction* and our Oasis team will review it together with you.\n\n` +
    `${pdfPublicUrl}\n\n` +
    `With warm regards,\n— Team Oasis Baklawa`;

  try {
    // Try document send first
    const docRes = await fetch("https://crm.click2api.in/api/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: apiKey,
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: apiPhone,
        type: "document",
        document: { link: pdfPublicUrl, filename: "Oasis-Account-Statement.pdf", caption: body },
      }),
    });
    if (docRes.ok) {
      const j = await docRes.json().catch(() => ({}));
      return j?.messages?.[0]?.id || j?.id || "sent";
    }
  } catch (e) {
    console.error("WA doc send error:", e);
  }

  // Fallback: text + link
  try {
    const txtRes = await fetch("https://crm.click2api.in/api/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: apiKey,
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: apiPhone,
        type: "text",
        text: { body },
      }),
    });
    const j = await txtRes.json().catch(() => ({}));
    return j?.messages?.[0]?.id || "sent";
  } catch (e) {
    console.error("WA text send error:", e);
    return null;
  }
}

interface RunArgs {
  company_id?: string | null;
  period_start?: string | null;
  period_end?: string | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    let body: RunArgs = {};
    try { body = await req.json(); } catch { /* cron call may be empty */ }

    // Default 15-day window ending today
    const today = new Date();
    const periodEnd = body.period_end ? new Date(body.period_end) : today;
    const periodStart = body.period_start
      ? new Date(body.period_start)
      : new Date(periodEnd.getTime() - 14 * 24 * 3600 * 1000);

    const periodStartIso = periodStart.toISOString().slice(0, 10);
    const periodEndIso = periodEnd.toISOString().slice(0, 10);

    // Resolve target companies
    let companies: { id: string; business_name: string; phone: string | null }[] = [];
    if (body.company_id) {
      const { data } = await supabaseAdmin
        .from("companies")
        .select("id, business_name, phone, payment_terms")
        .eq("id", body.company_id)
        .maybeSingle();
      if (data) companies = [data as any];
    } else {
      const { data } = await supabaseAdmin
        .from("companies")
        .select("id, business_name, phone, payment_terms")
        .eq("payment_terms", "credit");
      companies = (data || []) as any;
    }

    if (companies.length === 0) {
      return new Response(JSON.stringify({ ok: true, generated: 0, reason: "no credit clients" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let generated = 0;
    const results: any[] = [];

    for (const company of companies) {
      // Pull orders in window
      const { data: orders } = await supabaseAdmin
        .from("orders")
        .select("id, status, sales_order_value, created_at")
        .eq("company_id", company.id)
        .gte("created_at", `${periodStartIso}T00:00:00`)
        .lte("created_at", `${periodEndIso}T23:59:59`)
        .order("created_at", { ascending: true });

      const rows = (orders || []).map((o: any) => ({
        date: o.created_at,
        orderRef: "SO-" + (o.id as string).slice(0, 8).toUpperCase(),
        status: (o.status || "").replace(/_/g, " "),
        amount: Number(o.sales_order_value || 0),
      }));
      const total = rows.reduce((s, r) => s + r.amount, 0);

      // Generate PDF
      const pdfBytes = await buildLedgerPdf({
        businessName: company.business_name,
        periodStart: periodStartIso,
        periodEnd: periodEndIso,
        rows,
        total,
      });

      // Upload
      const path = `ledgers/${company.id}/${periodStartIso}_${periodEndIso}_${Date.now()}.pdf`;
      const { error: upErr } = await supabaseAdmin.storage
        .from("final-invoices")
        .upload(path, pdfBytes, { contentType: "application/pdf", upsert: true });

      if (upErr) {
        console.error(`Upload failed for ${company.business_name}:`, upErr);
        results.push({ company: company.business_name, ok: false, error: upErr.message });
        continue;
      }

      const { data: pub } = supabaseAdmin.storage.from("final-invoices").getPublicUrl(path);
      const pdfUrl = pub.publicUrl;

      // Insert ledger record
      const { data: ledger } = await supabaseAdmin
        .from("bi_monthly_ledgers")
        .insert({
          company_id: company.id,
          period_start: periodStartIso,
          period_end: periodEndIso,
          total_amount: total,
          order_count: rows.length,
          pdf_url: pdfUrl,
          status: "sent",
          sent_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      // Send via WhatsApp if phone available
      let waId: string | null = null;
      if (company.phone) {
        waId = await sendWhatsAppPdf(company.phone, company.business_name, pdfUrl);
        if (waId && ledger?.id) {
          await supabaseAdmin
            .from("bi_monthly_ledgers")
            .update({ whatsapp_message_id: waId })
            .eq("id", ledger.id);
        }
      }

      generated += 1;
      results.push({
        company: company.business_name,
        ok: true,
        order_count: rows.length,
        total,
        pdf_url: pdfUrl,
        wa_sent: !!waId,
      });
    }

    return new Response(JSON.stringify({
      ok: true,
      generated,
      period_start: periodStartIso,
      period_end: periodEndIso,
      results,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-bi-monthly-ledger error:", e);
    return new Response(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : "unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
