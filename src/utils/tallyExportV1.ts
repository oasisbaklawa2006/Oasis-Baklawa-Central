/**
 * Tally Bridge v1 — CSV export for single-order, per-dispatch-leg accounting lines.
 * Uses packed quantities from packing_lists (no whole-SO fallthrough for partial shipments).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  calculateLineTax,
  calculateLineTotal,
  calculatePackPrice,
  getGstRate,
  getHsnCode,
  getProductCategory,
  getPrimaryPackWeightKg,
} from "@/utils/pricing";

const PRODUCT_SELECT = [
  "id",
  "name",
  "mrp",
  "mrp_per_pc",
  "price_per_kg",
  "base_price",
  "wholesale_price",
  "price_b2b",
  "price_wholesale",
  "price_horeca",
  "price_special",
  "avg_weight_per_pack",
  "net_weight_grams",
  "gst_percentage",
  "hsn_code",
  "uom",
  "category",
  "sub_category",
  "moq",
  "packs_per_master_carton",
  "pcs_per_master_carton",
].join(", ");

/** Statuses at or after physical dispatch (export readiness). */
const EXPORT_READY_STATUSES = new Set(["dispatched", "delivered", "closed"]);

export function isOrderReadyForTallyExportV1(status: string): boolean {
  return EXPORT_READY_STATUSES.has(String(status || "").toLowerCase());
}

function escapeCsvCell(value: string | number): string {
  const s = value === null || value === undefined ? "" : String(value);
  if (/[\r\n",]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function money(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2);
}

export interface TallyBridgeV1PackingLine {
  id: string;
  product_id: string | null;
  order_item_id: string | null;
  packed_quantity: number;
}

export interface TallyBridgeV1DispatchLeg {
  dispatch: {
    id: string;
    dispatch_date: string | null;
    dispatch_number: string | null;
    is_partial: boolean;
    transporter_name: string | null;
    tracking_number: string | null;
  };
  packingLines: TallyBridgeV1PackingLine[];
}

export interface TallyBridgeV1ExportData {
  order: {
    id: string;
    status: string;
    final_invoice_url: string | null;
    sales_order_value: number | null;
  };
  company: {
    business_name: string | null;
    gst_number: string | null;
    price_tier: string | null;
  } | null;
  dispatches: TallyBridgeV1DispatchLeg[];
  productsById: Map<string, Record<string, unknown>>;
}

export async function fetchTallyBridgeV1ExportData(
  client: SupabaseClient<Database>,
  orderId: string,
): Promise<{ ok: true; data: TallyBridgeV1ExportData } | { ok: false; error: string }> {
  const { data: order, error: orderErr } = await client
    .from("orders")
    .select("id, status, company_id, final_invoice_url, sales_order_value")
    .eq("id", orderId)
    .maybeSingle();

  if (orderErr) {
    return { ok: false, error: orderErr.message };
  }
  if (!order) {
    return { ok: false, error: "Order not found." };
  }
  if (!isOrderReadyForTallyExportV1(order.status)) {
    return {
      ok: false,
      error: "Order must be at least dispatched (dispatched, delivered, or closed) before export.",
    };
  }

  let company: TallyBridgeV1ExportData["company"] = null;
  if (order.company_id) {
    const { data: comp } = await client
      .from("companies")
      .select("business_name, gst_number, price_tier")
      .eq("id", order.company_id)
      .maybeSingle();
    if (comp) {
      company = {
        business_name: comp.business_name,
        gst_number: comp.gst_number,
        price_tier: comp.price_tier ?? null,
      };
    }
  }

  const { data: dispatches, error: dispErr } = await client
    .from("dispatches")
    .select("id, dispatch_date, dispatch_number, is_partial, transporter_name, tracking_number")
    .eq("order_id", orderId)
    .order("dispatch_date", { ascending: true, nullsFirst: false });

  if (dispErr) {
    return { ok: false, error: dispErr.message };
  }
  if (!dispatches?.length) {
    return {
      ok: false,
      error: "No dispatch legs found for this order. Export requires at least one dispatch record.",
    };
  }

  const dispatchIds = dispatches.map((d) => d.id);
  const { data: packingRows } = await client
    .from("packing_lists")
    .select("id, dispatch_id, product_id, order_item_id, packed_quantity")
    .in("dispatch_id", dispatchIds);

  const productIds = [
    ...new Set((packingRows || []).map((r) => r.product_id).filter(Boolean)),
  ] as string[];

  const productsById = new Map<string, Record<string, unknown>>();
  if (productIds.length > 0) {
    const { data: products } = await client.from("products").select(PRODUCT_SELECT).in("id", productIds);
    for (const p of products || []) {
      productsById.set(p.id, p as Record<string, unknown>);
    }
  }

  const packingByDispatch = new Map<string, NonNullable<typeof packingRows>>();
  for (const row of packingRows || []) {
    if (!row.dispatch_id) continue;
    const list = packingByDispatch.get(row.dispatch_id) || [];
    list.push(row);
    packingByDispatch.set(row.dispatch_id, list);
  }

  const legs: TallyBridgeV1DispatchLeg[] = dispatches.map((d) => ({
    dispatch: {
      id: d.id,
      dispatch_date: d.dispatch_date,
      dispatch_number: d.dispatch_number,
      is_partial: Boolean(d.is_partial),
      transporter_name: d.transporter_name,
      tracking_number: d.tracking_number,
    },
    packingLines: (packingByDispatch.get(d.id) || []).map((r) => ({
      id: r.id,
      product_id: r.product_id,
      order_item_id: r.order_item_id,
      packed_quantity: Number(r.packed_quantity) || 0,
    })),
  }));

  return {
    ok: true,
    data: {
      order: {
        id: order.id,
        status: order.status,
        final_invoice_url: order.final_invoice_url,
        sales_order_value: order.sales_order_value,
      },
      company,
      dispatches: legs,
      productsById,
    },
  };
}

const CSV_HEADER = [
  "order_id",
  "order_status",
  "party_name",
  "party_gstin",
  "sales_order_value_db",
  "final_invoice_linked",
  "dispatch_id",
  "dispatch_number",
  "dispatch_date",
  "is_partial_leg",
  "transporter_name",
  "tracking_number",
  "packing_list_line_id",
  "order_item_id",
  "product_id",
  "item_description",
  "hsn_code",
  "uom",
  "quantity_this_leg",
  "rate_per_unit",
  "taxable_value",
  "gst_rate_pct",
  "gst_amount",
  "line_total_incl_tax",
] as const;

export function buildTallyBridgeV1Csv(
  data: TallyBridgeV1ExportData,
  options?: { dispatchId?: string | null },
):
  | { ok: true; csv: string; filename: string; warnings: string[] }
  | { ok: false; error: string; warnings: string[] } {
  const warnings: string[] = [];
  if (!data.order.final_invoice_url) {
    warnings.push(
      "Final invoice URL is not on file for this order. Export is allowed — verify taxable values and GST against your signed invoice before posting to Tally.",
    );
  }

  const tier = data.company?.price_tier ?? null;
  const partyName = data.company?.business_name ?? "";
  const partyGst = data.company?.gst_number ?? "";

  let legs = data.dispatches;
  if (options?.dispatchId) {
    legs = legs.filter((l) => l.dispatch.id === options.dispatchId);
    if (legs.length === 0) {
      return {
        ok: false,
        error: "Selected dispatch was not found on this order.",
        warnings,
      };
    }
  }

  const rows: string[][] = [Array.from(CSV_HEADER)];

  let exportedLines = 0;
  for (const leg of legs) {
    const { dispatch } = leg;
    if (leg.packingLines.length === 0) {
      warnings.push(
        `Dispatch ${dispatch.id.slice(0, 8)}… has no packing list lines — leg skipped (no whole-order fallback).`,
      );
      continue;
    }

    for (const pl of leg.packingLines) {
      if (!pl.product_id) {
        warnings.push(`Packing line ${pl.id.slice(0, 8)}… has no product_id — row skipped.`);
        continue;
      }
      const product = data.productsById.get(pl.product_id);
      if (!product) {
        warnings.push(`Product ${pl.product_id.slice(0, 8)}… not found — row skipped.`);
        continue;
      }
      const qty = pl.packed_quantity;
      if (qty <= 0) {
        warnings.push(`Packing line ${pl.id.slice(0, 8)}… has zero quantity — row skipped.`);
        continue;
      }

      const cat = getProductCategory(product);
      const uom = cat === "bulk_kg" ? "Box" : "Pc";
      const rate = calculatePackPrice(product, tier);
      const taxable = calculateLineTotal(product, qty, tier);
      const gstAmt = calculateLineTax(product, qty, tier);
      const gstPct = getGstRate(product);
      const total = taxable + gstAmt;

      let desc = String(product.name ?? "—");
      if (cat === "bulk_kg") {
        const wt = getPrimaryPackWeightKg(product);
        if (wt > 0) desc += ` (${wt}kg/box)`;
      }

      exportedLines += 1;
      rows.push([
        data.order.id,
        data.order.status,
        partyName,
        partyGst,
        money(Number(data.order.sales_order_value ?? 0)),
        data.order.final_invoice_url ? "Y" : "N",
        dispatch.id,
        dispatch.dispatch_number ?? "",
        dispatch.dispatch_date ?? "",
        dispatch.is_partial ? "Y" : "N",
        dispatch.transporter_name ?? "",
        dispatch.tracking_number ?? "",
        pl.id,
        pl.order_item_id ?? "",
        pl.product_id,
        desc,
        getHsnCode(product),
        uom,
        String(qty),
        money(rate),
        money(taxable),
        String(gstPct),
        money(gstAmt),
        money(total),
      ]);
    }
  }

  if (exportedLines === 0) {
    return {
      ok: false,
      error: "No exportable lines: check packing lists and product links for the selected dispatch leg(s).",
      warnings,
    };
  }

  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const filename = `tally-bridge-v1-${data.order.id.slice(0, 8)}-${stamp}.csv`;
  const csv = rows.map((r) => r.map(escapeCsvCell).join(",")).join("\r\n");

  return { ok: true, csv, filename, warnings };
}

export async function exportTallyBridgeV1ToCsv(
  client: SupabaseClient<Database>,
  orderId: string,
  options?: { dispatchId?: string | null },
): Promise<
  { ok: true; csv: string; filename: string; warnings: string[] } | { ok: false; error: string; warnings?: string[] }
> {
  const fetched = await fetchTallyBridgeV1ExportData(client, orderId);
  if (!fetched.ok) {
    return { ok: false, error: fetched.error };
  }
  return buildTallyBridgeV1Csv(fetched.data, options);
}
