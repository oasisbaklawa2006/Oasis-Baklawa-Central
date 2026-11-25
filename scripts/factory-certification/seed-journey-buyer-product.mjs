#!/usr/bin/env node
/**
 * Disposable-fixture data for the Buyer-to-Dispatch journey ONLY (never run by the Factory lane).
 *
 * Core completes an order line only from production accepted by RGS receiving, so the journey needs a Buyer-priced,
 * producible product with NO finished-goods stock. The shared fixture prices exactly one product (CERT-ARABIC-001) and
 * it already has stock on hand. This script gives the existing, stock-free CERT-BAKERY-001 the same approved B2B price
 * and MOQ rule the fixture gives CERT-ARABIC-001. It is fixture setup, like seed-production-fixtures.mjs: it writes only
 * product_pricing_rules and product_moq_rules, refuses every non-loopback host, and NEVER touches stock, orders or any
 * governed business record. If the product already has stock the script fails: stock is never altered to qualify it.
 */
import { assertNoSupabaseError, createLocalSupabaseAdminClient } from "./local-supabase-client.mjs";

const baseUrl = process.env.FACTORY_CERT_SUPABASE_URL?.trim();
const serviceRoleKey = process.env.FACTORY_CERT_LOCAL_SERVICE_ROLE_KEY?.trim();
if (!baseUrl || !serviceRoleKey) {
  throw new Error("Journey fixture requires the loopback Supabase URL and the disposable service-role key");
}

const PRODUCT_ID = "20000000-0000-4000-8000-000000000104"; // CERT-BAKERY-001 (production_department: bakery)
const PRODUCT_SKU = "CERT-BAKERY-001";

const { client: supabase } = createLocalSupabaseAdminClient({ baseUrl, serviceRoleKey, callerLabel: "Journey fixture" });

const { data: product, error: productError } = await supabase.from("products").select("id,sku,production_department,is_active").eq("id", PRODUCT_ID).maybeSingle();
assertNoSupabaseError(productError, "Journey fixture product read failed");
if (!product || product.sku !== PRODUCT_SKU || product.is_active !== true || product.production_department !== "bakery") {
  throw new Error(`JOURNEY_FIXTURE_PRODUCT_UNEXPECTED: ${JSON.stringify(product)}`);
}

const { data: stock, error: stockError } = await supabase
  .from("inventory_stock_balances")
  .select("available_qty,reserved_qty,picked_qty")
  .eq("product_id", PRODUCT_ID)
  .eq("location_code", "FINISHED_GOODS");
assertNoSupabaseError(stockError, "Journey fixture stock read failed");
const onHand = (stock ?? []).reduce((sum, row) => sum + Number(row.available_qty ?? 0) + Number(row.reserved_qty ?? 0) + Number(row.picked_qty ?? 0), 0);
if (onHand !== 0) {
  throw new Error(`JOURNEY_FIXTURE_PRODUCT_HAS_STOCK: ${PRODUCT_SKU} has ${onHand} finished goods on hand; stock is never altered to qualify a product`);
}

const { data: existingPrice, error: priceReadError } = await supabase.from("product_pricing_rules").select("id").eq("product_id", PRODUCT_ID).eq("price_channel", "b2b").limit(1);
assertNoSupabaseError(priceReadError, "Journey fixture pricing read failed");
if (!existingPrice?.length) {
  const { error: pricingError } = await supabase.from("product_pricing_rules").insert({
    product_id: PRODUCT_ID,
    price_channel: "b2b",
    approval_status: "approved",
    base_price: 100,
    calculated_price: 100,
    currency: "INR",
    uom: "kg",
    gst_rate: 0,
    tax_inclusive: true,
  });
  assertNoSupabaseError(pricingError, "Journey fixture B2B pricing insert failed");
}

const { data: existingMoq, error: moqReadError } = await supabase.from("product_moq_rules").select("id").eq("product_id", PRODUCT_ID).eq("channel", "b2b").limit(1);
assertNoSupabaseError(moqReadError, "Journey fixture MOQ read failed");
if (!existingMoq?.length) {
  const { error: moqError } = await supabase.from("product_moq_rules").insert({
    product_id: PRODUCT_ID,
    channel: "b2b",
    moq_applicable: true,
    moq_value: 1,
    increment_value: 1,
    min_carton_qty: 1,
  });
  assertNoSupabaseError(moqError, "Journey fixture B2B MOQ insert failed");
}

console.log(`Journey fixture ready: ${PRODUCT_SKU} is Buyer-priced (B2B, approved), producible (bakery) and stock-free.`);
