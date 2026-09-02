#!/usr/bin/env node
/**
 * Deterministic Production-TV fixtures for the disposable local Factory
 * certification database. This script refuses every non-loopback Supabase host.
 * It uses service_role only during local bootstrap, never in browser tests.
 */

import {
  assertNoSupabaseError,
  createLocalSupabaseAdminClient,
  runLocalPostgresRoleStatement,
} from "./local-supabase-client.mjs";

const baseUrl = process.env.FACTORY_CERT_SUPABASE_URL?.trim();
const serviceRoleKey = process.env.FACTORY_CERT_LOCAL_SERVICE_ROLE_KEY?.trim();
const localDbUrl = process.env.FACTORY_CERT_LOCAL_DB_URL?.trim();
if (!baseUrl || !serviceRoleKey || !localDbUrl) {
  throw new Error("FACTORY_CERT_SUPABASE_URL, FACTORY_CERT_LOCAL_SERVICE_ROLE_KEY and FACTORY_CERT_LOCAL_DB_URL are required");
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

// Deterministic fixtures for the FACT-E2E continuous golden-order
// certification (tests/factory-operations-golden-order.cert.spec.ts).
// These are prerequisite catalogue/stock rows only -- no order_items,
// production_jobs, b2b_dispatch_*, or b2b_assembly_* row here represents a
// governed business transition; every one of those is created exclusively
// by the spec calling the governed RPCs under test.
const GOLDEN_ORDER_COMPANY_ID = "30000000-0000-4000-8000-000000000001";
const GOLDEN_ORDER_ID = "30000000-0000-4000-8000-000000000002";
const GOLDEN_ORDER_ITEM_ID = "30000000-0000-4000-8000-000000000003";
const GOLDEN_ORDER_FG_COMPONENT_PRODUCT_ID = products[0].id; // reuse CERT-ARABIC-001 (arabic_sweets)
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

// Two Core triggers gate a raw INSERT into public.orders, and both carve out
// exactly one bypass: a literal session_user='postgres' connection with no
// authenticated JWT context.
//
// - protect_order_authority_fields() (20260809060000_wave1b_server_authority_foundation.sql)
//   rejects any non-'postgres'-role INSERT whose status is outside
//   draft/submitted, or whose payment_cleared/advance_paid/finance_verified_*
//   fields are already set -- those transitions are Finance-authority-only.
// - assign_order_number_on_insert() (20260901005700_app_e2e_order_creation_scope_hardening.sql)
//   rejects any INSERT that carries an explicit order_number unless the
//   caller is that same literal postgres session; every other caller must go
//   through a governed order-creation RPC (submit_customer_order_v1 /
//   promote_sales_order_draft_to_order_governed_v1), which allocate the
//   number themselves and are not suitable for seeding a deterministic
//   fixture id/order_number pair.
//
// The certification service-role client authenticates through PostgREST and
// runs as role 'service_role', not 'postgres', so it can satisfy neither
// bypass. This one row is therefore written via a direct native-Postgres
// connection as the literal postgres role (see runLocalPostgresRoleStatement)
// instead -- exactly the carve-out both triggers document, not a bypass of
// governance. It stays at the insert-permitted draft/unpaid state; none of
// the governed RPCs the golden-order spec calls require a later order status
// or payment state at seed time (F0/F1 clearance and release happen later in
// the spec itself, through the real governed RPCs).
runLocalPostgresRoleStatement(
  localDbUrl,
  `INSERT INTO public.orders (
     id, company_id, status, order_number, sales_order_value, advance_required,
     advance_paid, payment_status, payment_cleared, order_origin, tracking_token
   ) VALUES (
     '${GOLDEN_ORDER_ID}', '${GOLDEN_ORDER_COMPANY_ID}', 'draft', 'FACT-E2E-GOLDEN-001', 500, 0,
     0, 'pending', false, 'MANUAL', 'fact-e2e-golden-tracking-001'
   )
   ON CONFLICT (id) DO UPDATE SET
     company_id = EXCLUDED.company_id, status = EXCLUDED.status, order_number = EXCLUDED.order_number,
     sales_order_value = EXCLUDED.sales_order_value, advance_required = EXCLUDED.advance_required,
     advance_paid = EXCLUDED.advance_paid, payment_status = EXCLUDED.payment_status,
     payment_cleared = EXCLUDED.payment_cleared, order_origin = EXCLUDED.order_origin,
     tracking_token = EXCLUDED.tracking_token;`,
  "Golden-order order fixture upsert",
);

const { error: goldenOrderItemError } = await supabase.from("order_items").upsert(
  {
    id: GOLDEN_ORDER_ITEM_ID,
    order_id: GOLDEN_ORDER_ID,
    product_id: GOLDEN_ORDER_FG_COMPONENT_PRODUCT_ID,
    quantity: 5,
    pack_size: "1kg",
    carton_type: "CARTON",
    notes: "FACT-E2E golden-order continuous certification fixture",
  },
  { onConflict: "id" },
);
assertNoSupabaseError(goldenOrderItemError, "Golden-order order_item fixture upsert failed");

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

// Deliberate shortfalls so the golden-order spec's single reserve_assembly_components
// call is forced down BOTH the RGS/Production shortage path (FINISHED_GOODS-sourced
// component) and the 3PGS bridge path (3PGS-sourced component) in the same run.
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
