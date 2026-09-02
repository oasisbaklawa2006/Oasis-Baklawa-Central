#!/usr/bin/env node
/**
 * Deterministic Production-TV fixtures for the disposable local Factory
 * certification database. This script refuses every non-loopback Supabase host.
 * It uses service_role only during local bootstrap, never in browser tests.
 */

import {
  assertNoSupabaseError,
  createLocalSupabaseAdminClient,
} from "./local-supabase-client.mjs";

const baseUrl = process.env.FACTORY_CERT_SUPABASE_URL?.trim();
const serviceRoleKey = process.env.FACTORY_CERT_LOCAL_SERVICE_ROLE_KEY?.trim();
if (!baseUrl || !serviceRoleKey) {
  throw new Error("FACTORY_CERT_SUPABASE_URL and FACTORY_CERT_LOCAL_SERVICE_ROLE_KEY are required");
}

const { client: supabase } = createLocalSupabaseAdminClient({
  baseUrl,
  serviceRoleKey,
  callerLabel: "Fixture seeding",
});

const products = [
  {
    id: "20000000-0000-4000-8000-000000000101",
    name: "Factory Cert Arabic Baklawa",
    category: "sweets",
    sku: "CERT-ARABIC-001",
    hsn_code: "1905",
    production_department: "arabic_sweets",
  },
  {
    id: "20000000-0000-4000-8000-000000000102",
    name: "Factory Cert Chocolate",
    category: "chocolates",
    sku: "CERT-CHOC-001",
    hsn_code: "1806",
    production_department: "chocolates_confectionery",
  },
  {
    id: "20000000-0000-4000-8000-000000000103",
    name: "Factory Cert Fusion Sweet",
    category: "sweets",
    sku: "CERT-FUSION-001",
    hsn_code: "1905",
    production_department: "fusion_sweets",
  },
  {
    id: "20000000-0000-4000-8000-000000000104",
    name: "Factory Cert Bakery",
    category: "bakery",
    sku: "CERT-BAKERY-001",
    hsn_code: "1905",
    production_department: "bakery",
  },
  {
    id: "20000000-0000-4000-8000-000000000105",
    name: "Factory Cert Nuts",
    category: "nuts",
    sku: "CERT-NUTS-001",
    hsn_code: "2008",
    production_department: "seasoned_nuts_mixes",
  },
];

const { error: productError } = await supabase
  .from("products")
  .upsert(products, { onConflict: "id" });
assertNoSupabaseError(productError, "Deterministic product fixture upsert failed");

const jobs = [
  {
    id: "e3ed28b0-0000-4000-8000-000000000001",
    product_id: products[0].id,
    department: "ARABIC_SWEETS",
    assigned_qty: 6,
    produced_qty: 0,
    priority: "normal",
    status: "pending",
    stage: "prep",
    correlation_id: "factory-cert-production-arabic",
  },
  {
    id: "c0c0a7e1-0000-4000-8000-000000000002",
    product_id: products[1].id,
    department: "CHOCOLATES_CONFECTIONERY",
    assigned_qty: 7,
    produced_qty: 0,
    priority: "normal",
    status: "pending",
    stage: "prep",
    correlation_id: "factory-cert-production-chocolate",
  },
  {
    id: "f0510a01-0000-4000-8000-000000000003",
    product_id: products[2].id,
    department: "FUSION_SWEETS",
    assigned_qty: 8,
    produced_qty: 0,
    priority: "normal",
    status: "pending",
    stage: "prep",
    correlation_id: "factory-cert-production-fusion",
  },
  {
    id: "ba4e0001-0000-4000-8000-000000000004",
    product_id: products[3].id,
    department: "BAKERY",
    assigned_qty: 9,
    produced_qty: 0,
    priority: "normal",
    status: "pending",
    stage: "prep",
    correlation_id: "factory-cert-production-bakery",
  },
  {
    id: "a0750001-0000-4000-8000-000000000005",
    product_id: products[4].id,
    department: "SEASONED_NUTS_MIXES",
    assigned_qty: 10,
    produced_qty: 0,
    priority: "normal",
    status: "pending",
    stage: "prep",
    correlation_id: "factory-cert-production-nuts",
  },
];

const { error: jobError } = await supabase
  .from("production_jobs")
  .upsert(jobs, { onConflict: "id" });
assertNoSupabaseError(jobError, "Deterministic Production job fixture upsert failed");

const { data: seeded, error: seededError } = await supabase
  .from("production_jobs")
  .select("id,canonical_department,status,assigned_qty,produced_qty,priority,correlation_id")
  .like("correlation_id", "factory-cert-production-%")
  .order("correlation_id", { ascending: true });
assertNoSupabaseError(seededError, "Seeded Production job verification read failed");

if (!Array.isArray(seeded) || seeded.length !== jobs.length) {
  throw new Error(`Expected ${jobs.length} seeded Production jobs; got ${Array.isArray(seeded) ? seeded.length : "invalid response"}`);
}

const expectedDepartments = new Set([
  "ARABIC_SWEETS",
  "CHOCOLATES_CONFECTIONERY",
  "FUSION_SWEETS",
  "BAKERY",
  "SEASONED_NUTS_MIXES",
]);
for (const row of seeded) {
  if (!expectedDepartments.has(String(row.canonical_department))) {
    throw new Error(`Seeded job ${row.id} has unexpected canonical department ${row.canonical_department}`);
  }
  if (row.status !== "pending" || row.priority !== "normal") {
    throw new Error(`Seeded job ${row.id} did not retain pending/normal fixture state`);
  }
}

const golden = seeded.find((row) => String(row.id).slice(0, 8).toUpperCase() === "E3ED28B0");
if (!golden || Number(golden.assigned_qty) !== 6 || Number(golden.produced_qty ?? 0) !== 0) {
  throw new Error("Golden E3ED28B0 fixture was not seeded with assigned=6 / produced=0");
}

console.log(`Seeded ${seeded.length} deterministic Production-TV jobs; golden short id E3ED28B0 is present.`);

// Deterministic prerequisites for the FACT-E2E continuous golden-order
// certification. Business transitions remain governed RPC calls in the spec.
const GOLDEN_ORDER_COMPANY_ID = "30000000-0000-4000-8000-000000000001";
const GOLDEN_ORDER_ID = "30000000-0000-4000-8000-000000000002";
const GOLDEN_ORDER_ITEM_ID = "30000000-0000-4000-8000-000000000003";
const GOLDEN_ORDER_FG_COMPONENT_PRODUCT_ID = products[0].id;
const GOLDEN_ORDER_3PGS_COMPONENT_PRODUCT_ID = "20000000-0000-4000-8000-000000000201";

const { error: goldenCompanyError } = await supabase.from("companies").upsert(
  {
    id: GOLDEN_ORDER_COMPANY_ID,
    business_name: "Factory FACT-E2E Golden Order Co",
    gst_number: "07AACCF0001A1Z6",
    registered_address: "New Delhi",
    status: "approved",
    payment_terms: "prepaid",
  },
  { onConflict: "id" },
);
assertNoSupabaseError(goldenCompanyError, "Golden-order company fixture upsert failed");

// Keep the deterministic order id, but let Core's canonical insert trigger
// allocate order_number. This avoids a native-Postgres fixture bypass and
// exercises the same server-owned numbering boundary as normal callers.
const { error: goldenOrderError } = await supabase.from("orders").insert({
  id: GOLDEN_ORDER_ID,
  company_id: GOLDEN_ORDER_COMPANY_ID,
  status: "draft",
  sales_order_value: 500,
  advance_required: 0,
  advance_paid: 0,
  payment_status: "pending",
  payment_cleared: false,
  order_origin: "MANUAL",
  tracking_token: "fact-e2e-golden-tracking-001",
});
assertNoSupabaseError(goldenOrderError, "Golden-order order fixture insert failed");

const { data: goldenOrder, error: goldenOrderReadError } = await supabase
  .from("orders")
  .select("id,order_number,status")
  .eq("id", GOLDEN_ORDER_ID)
  .single();
assertNoSupabaseError(goldenOrderReadError, "Golden-order order fixture verification read failed");
if (!goldenOrder?.order_number || goldenOrder.status !== "draft") {
  throw new Error("Golden-order Core-owned order numbering/status verification failed");
}

const { error: goldenOrderItemError } = await supabase.from("order_items").insert({
  id: GOLDEN_ORDER_ITEM_ID,
  order_id: GOLDEN_ORDER_ID,
  product_id: GOLDEN_ORDER_FG_COMPONENT_PRODUCT_ID,
  quantity: 5,
  pack_size: "1kg",
  carton_type: "CARTON",
  notes: "FACT-E2E golden-order continuous certification fixture",
});
assertNoSupabaseError(goldenOrderItemError, "Golden-order order_item fixture insert failed");

const { error: pkgProductError } = await supabase.from("products").upsert(
  {
    id: GOLDEN_ORDER_3PGS_COMPONENT_PRODUCT_ID,
    name: "Factory Cert 3PGS Gift Packaging",
    category: "packaging",
    sku: "CERT-3PGS-PKG-001",
    hsn_code: "4819",
  },
  { onConflict: "id" },
);
assertNoSupabaseError(pkgProductError, "Golden-order 3PGS packaging product fixture upsert failed");

const { error: fgBalanceError } = await supabase.from("inventory_stock_balances").upsert(
  {
    product_id: GOLDEN_ORDER_FG_COMPONENT_PRODUCT_ID,
    sku: "CERT-ARABIC-001",
    location_code: "FINISHED_GOODS",
    available_qty: 2,
    reserved_qty: 0,
  },
  { onConflict: "product_id,sku,location_code" },
);
assertNoSupabaseError(fgBalanceError, "Golden-order FINISHED_GOODS stock-balance fixture upsert failed");

const { error: pkgBalanceError } = await supabase.from("inventory_stock_balances").upsert(
  {
    product_id: GOLDEN_ORDER_3PGS_COMPONENT_PRODUCT_ID,
    sku: "CERT-3PGS-PKG-001",
    location_code: "3PGS",
    available_qty: 0,
    reserved_qty: 0,
  },
  { onConflict: "product_id,sku,location_code" },
);
assertNoSupabaseError(pkgBalanceError, "Golden-order 3PGS stock-balance fixture upsert failed");

console.log("Seeded FACT-E2E golden-order company/order/order_item and deliberate FINISHED_GOODS/3PGS shortfalls.");
