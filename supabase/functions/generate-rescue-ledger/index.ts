// Generate Rescue-Period (28th) Soft Ledger
// - Targets credit clients with outstanding balance OR a recent rescue payment
// - PDF shows: prior rescue balance + ALL accrued purchases since rescue_payment_date
// - Soft tone WhatsApp message via Click2API
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";

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
  return new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

async function buildRescuePdf(args: {
  businessName: string;
  rescueBalance: number;
  rescuePaidOn: string | null;
  accruedRows: { date: string; orderRef: string; amount: number }[];
  accruedTotal: number;
  totalDue: number;
  settlementDeadline: string | null;
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const helv = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const champagne = rgb(0.72, 0.52, 0.04);
  const ink = rgb(0.13, 0.16, 0.22);
  const mute = rgb(0.45, 0.49, 0.55);
  const soft = rgb(0.92, 0.85, 0.62);

  // Header
  page.drawText("OASIS BAKLAWA", { x: 40, y: 790, size: 18, font: bold, color: ink });
  page.drawText("Continuity Period Statement", { x: 40, y: 770, size: 11, font: helv, color: mute });
  page.drawText("Settlement Reminder", { x: 400, y: 790, size: 12, font: bold, color: champagne });
  if (args.settlementDeadline) {
    page.drawText(`Due by: ${fmtDate(args.settlementDeadline)}`, {
      x: 400, y: 772, size: 9, font: helv, color: mute,
    });
  }

  page.drawLine({ start: { x: 40, y: 755 }, end: { x: 555, y: 755 }, thickness: 1, color: champagne });

  // Soft greeting
  page.drawText("BILLED TO", { x: 40, y: 730, size: 8, font: bold, color: mute });
  page.drawText(args.businessName, { x: 40, y: 712, size: 13, font: bold, color: ink });

  page.drawText("Dear Partner,", { x: 40, y: 685, size: 10, font: helv, color: ink });
  page.drawText("Thank you for the rescue payment that restored your continuity. Below is a gentle summary", {
    x: 40, y: 668, size: 9, font: helv, color: mute,
  });
  page.drawText("of the remaining rescue balance and all purchases made during the continuity window.", {
    x: 40, y: 654, size: 9, font: helv, color: mute,
  });

  // Rescue balance band
  page.drawRectangle({ x: 40, y: 615, width: 515, height: 30, color: soft });
  page.drawText("REMAINING RESCUE BALANCE", { x: 50, y: 628, size: 9, font: bold, color: ink });
  page.drawText(fmtINR(args.rescueBalance), { x: 460, y: 624, size: 13, font: bold, color: ink });
  if (args.rescuePaidOn) {
    page.drawText(`since ${fmtDate(args.rescuePaidOn)}`, { x: 50, y: 618, size: 7, font: helv, color: mute });
  }

  // Accrued table
  let y = 580;
  page.drawText("ACCRUED PURCHASES (CONTINUITY PERIOD)", { x: 40, y, size: 9, font: bold, color: ink });
  y -= 18;
  page.drawRectangle({ x: 40, y: y - 4, width: 515, height: 22, color: rgb(0.96, 0.97, 0.99) });
  page.drawText("DATE", { x: 50, y: y + 4, size: 9, font: bold, color: ink });
  page.drawText("ORDER REF", { x: 145, y: y + 4, size: 9, font: bold, color: ink });
  page.drawText("AMOUNT", { x: 480, y: y + 4, size: 9, font: bold, color: ink });
  y -= 24;

  for (const r of args.accruedRows) {
    if (y < 140) {
      page.drawText("(continued)", { x: 40, y: 130, size: 8, font: helv, color: mute });
      break;
    }
    page.drawText(fmtDate(r.date), { x: 50, y, size: 9, font: helv, color: ink });
    page.drawText(r.orderRef, { x: 145, y, size: 9, font: helv, color: ink });
    page.drawText(fmtINR(r.amount), { x: 480, y, size: 9, font: bold, color: ink });
    y -= 14;
  }

  if (args.accruedRows.length === 0) {
    page.drawText("No new orders during continuity period.", { x: 50, y, size: 9, font: helv, color: mute });
    y -= 16;
  }

  // Totals
  y = Math.min(y, 130);
  page.drawLine({ start: { x: 40, y: y + 6 }, end: { x: 555, y: y + 6 }, thickness: 0.5, color: mute });
  page.drawText("Accrued total", { x: 50, y: y - 8, size: 9, font: helv, color: mute });
  page.drawText(fmtINR(args.accruedTotal), { x: 480, y: y - 8, size: 9, font: helv, color: ink });

  page.drawLine({ start: { x: 40, y: y - 18 }, end: { x: 555, y: y - 18 }, thickness: 1, color: champagne });
  page.drawText("TOTAL SETTLEMENT DUE BY MONTH-END", { x: 50, y: y - 32, size: 10, font: bold, color: ink });
  page.drawText(fmtINR(args.totalDue), { x: 460, y: y - 32, size: 13, font: bold, color: champagne });

  // Footer
  page.drawText("With warm regards — Team Oasis Baklawa", { x: 40, y: 50, size: 9, font: helv, color: mute });
  page.drawText(PORTAL_URL, { x: 40, y: 36, size: 8, font: helv, color: champagne });

  return await pdf.save();
}

async function sendSoftWhatsApp(phone: string, businessName: string, totalDue: number, deadline: string | null, pdfUrl: string) {
  const apiKey = Deno.env.get("CLICK2API_API_KEY");
  if (!apiKey) return null;
  const accessToken = Deno.env.get("CLICK2API_ACCESS_TOKEN");
  const apiPhone = to91(phone);

  const deadlineStr = deadline ? fmtDate(deadline) : "month-end";
  const body =
    `Dear ${businessName},\n\n` +
    `A gentle reminder of your continuity-period statement.\n\n` +
    `Total settlement due by *${deadlineStr}*: *${fmtINR(totalDue)}*\n\n` +
    `This includes the remaining rescue balance and all new purchases during the continuity window.\n\n` +
    `Full ledger: ${pdfUrl}\n\n` +
    `If anything looks off, kindly reply *Request Correction* and our team will gladly review with you.\n\n` +
    `With warm regards,\n— Team Oasis Baklawa`;

  try {
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
        document: { link: pdfUrl, filename: "Oasis-Continuity-Statement.pdf", caption: body },
      }),
    });
    if (docRes.ok) {
      const j = await docRes.json().catch(() => ({}));
      return j?.messages?.[0]?.id || j?.id || "sent";
    }
  } catch (e) {
    console.error("WA doc send error:", e);
  }

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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    let body: { company_id?: string } = {};
    try { body = await req.json(); } catch { /* cron empty */ }

    // Target: credit clients with outstanding > 0 OR with a rescue_payment_date in the current month
    const startOfMonthIst = (() => {
      const now = new Date();
      const ist = new Date(now.getTime() + 5.5 * 3600 * 1000);
      return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), 1)).toISOString();
    })();

    let query = supabase
      .from("companies")
      .select("id, business_name, phone, total_outstanding, rescue_payment_date, settlement_deadline")
      .eq("payment_terms", "credit");

    if (body.company_id) {
      query = query.eq("id", body.company_id);
    } else {
      query = query.gt("total_outstanding", 0);
    }

    const { data: companies } = await query;
    const targets = (companies || []).filter((c: any) =>
      Number(c.total_outstanding || 0) > 0 || (c.rescue_payment_date && c.rescue_payment_date >= startOfMonthIst)
    );

    if (targets.length === 0) {
      return new Response(JSON.stringify({ ok: true, generated: 0, reason: "no eligible clients" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: any[] = [];
    let generated = 0;

    for (const company of targets) {
      // Anchor: rescue_payment_date if present, else start of current month
      const anchor = company.rescue_payment_date || startOfMonthIst;

      // Sum of orders since anchor
      const { data: orders } = await supabase
        .from("orders")
        .select("id, sales_order_value, created_at")
        .eq("company_id", company.id)
        .gte("created_at", anchor)
        .not("status", "in", "(draft,cart,cancelled)")
        .order("created_at", { ascending: true });

      const accruedRows = (orders || []).map((o: any) => ({
        date: o.created_at,
        orderRef: "SO-" + (o.id as string).slice(0, 8).toUpperCase(),
        amount: Number(o.sales_order_value || 0),
      }));
      const accruedTotal = accruedRows.reduce((s, r) => s + r.amount, 0);
      const totalDue = Number(company.total_outstanding || 0);
      const rescueBalance = Math.max(0, totalDue - accruedTotal);

      const pdfBytes = await buildRescuePdf({
        businessName: company.business_name,
        rescueBalance,
        rescuePaidOn: company.rescue_payment_date,
        accruedRows,
        accruedTotal,
        totalDue,
        settlementDeadline: company.settlement_deadline,
      });

      const path = `rescue/${company.id}/${new Date().toISOString().slice(0, 10)}_${Date.now()}.pdf`;
      const { error: upErr } = await supabase.storage
        .from("final-invoices")
        .upload(path, pdfBytes, { contentType: "application/pdf", upsert: true });

      if (upErr) {
        results.push({ company: company.business_name, ok: false, error: upErr.message });
        continue;
      }

      const { data: pub } = supabase.storage.from("final-invoices").getPublicUrl(path);
      const pdfUrl = pub.publicUrl;

      // Log as ledger row (status: rescue_reminder)
      const periodStart = anchor.slice(0, 10);
      const periodEnd = new Date().toISOString().slice(0, 10);
      const { data: ledger } = await supabase
        .from("bi_monthly_ledgers")
        .insert({
          company_id: company.id,
          period_start: periodStart,
          period_end: periodEnd,
          total_amount: totalDue,
          order_count: accruedRows.length,
          pdf_url: pdfUrl,
          status: "rescue_reminder",
          sent_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      let waId: string | null = null;
      if (company.phone) {
        waId = await sendSoftWhatsApp(company.phone, company.business_name, totalDue, company.settlement_deadline, pdfUrl);
        if (waId && ledger?.id) {
          await supabase.from("bi_monthly_ledgers").update({ whatsapp_message_id: waId }).eq("id", ledger.id);
        }
      }

      generated += 1;
      results.push({
        company: company.business_name,
        ok: true,
        rescue_balance: rescueBalance,
        accrued: accruedTotal,
        total_due: totalDue,
        pdf_url: pdfUrl,
        wa_sent: !!waId,
      });
    }

    return new Response(JSON.stringify({ ok: true, generated, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-rescue-ledger error:", e);
    return new Response(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : "unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
