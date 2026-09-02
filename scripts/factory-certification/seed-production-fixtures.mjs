#!/usr/bin/env node
/**
 * Deterministic Production-TV fixtures for the disposable local Factory
 * certification database. This script refuses every non-loopback Supabase host.
 * Privileged bootstrap is limited to prerequisite identities/catalogue/stock;
 * the golden Sales Order itself is created through Core's governed Buyer RPCs.
 */

import { randomBytes } from "node:crypto";
import { appendFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import {
  assertNoSupabaseError,
  createLocalSupabaseAdminClient,
  runLocalPostgresRoleStatement,
} from "./local-supabase-client.mjs";

const baseUrl = process.env.FACTORY_CERT_SUPABASE_URL?.trim();
const serviceRoleKey = process.env.FACTORY_CERT_LOCAL_SERVICE_ROLE_KEY?.trim();
const anonKey = process.env.FACTORY_CERT_SUPABASE_ANON_KEY?.trim();
const localDbUrl = process.env.FACTORY_CERT_LOCAL_DB_URL?.trim();
const credentialFile = process.env.FACTORY_CERT_CREDENTIAL_FILE?.trim();
if (!baseUrl || !serviceRoleKey || !anonKey || !localDbUrl || credentialFile !== "/tmp/oasis-factory-certification.env") {
  throw new Error("Factory certification requires loopback Supabase/admin/anon/Postgres credentials and the fixed credential file");
}

const { client: supabase, localSupabaseOrigin } = createLocalSupabaseAdminClient({
  baseUrl,
  serviceRoleKey,
  callerLabel: "Fixture seeding",
});

const products = [
  {
    id: "20000000-0000-4000-8000-000000000101",
    product_name: "Factory Cert Arabic Baklawa",
    name: "Factory Cert Arabic Baklawa",
    category: "sweets",
    sku: "CERT-ARABIC-001",
    hsn_code: "1905",
    production_department: "arabic_sweets",
    is_active: true,
    visible_in_catalog: true,
    is_catalogue_ready: true,
    moq_value: 1,
    increment_value: 1,
    base_price: 100,
    price_b2b: 100,
  },
  { id: "20000000-0000-4000-8000-000000000102", name: "Factory Cert Chocolate", category: "chocolates", sku: "CERT-CHOC-001", hsn_code: "1806", production_department: "chocolates_confectionery" },
  { id: "20000000-0000-4000-8000-000000000103", name: "Factory Cert Fusion Sweet", category: "sweets", sku: "CERT-FUSION-001", hsn_code: "1905", production_department: "fusion_sweets" },
  { id: "20000000-0000-4000-8000-000000000104", name: "Factory Cert Bakery", category: "bakery", sku: "CERT-BAKERY-001", hsn_code: "1905", production_department: "bakery" },
  { id: "20000000-0000-4000-8000-000000000105", name: "Factory Cert Nuts", category: "nuts", sku: "CERT-NUTS-001", hsn_code: "2008", production_department: "seasoned_nuts_mixes" },
];

const { error: productError } = await supabase.from("products").upsert(products, { onConflict: "id" });
assertNoSupabaseError(productError, "Deterministic product fixture upsert failed");

const jobs = [
  { id: "e3ed28b0-0000-4000-8000-000000000001", product_id: products[0].id, department: "ARABIC_SWEETS", assigned_qty: 6, produced_qty: 0, priority: "normal", status: "pending", stage: "prep", correlation_id: "factory-cert-production-arabic" },
  { id: "c0c0a7e1-0000-4000-8000-000000000002", product_id: products[1].id, department: "CHOCOLATES_CONFECTIONERY", assigned_qty: 7, produced_qty: 0, priority: "normal", status: "pending", stage: "prep", correlation_id: "factory-cert-production-chocolate" },
  { id: "f0510a01-0000-4000-8000-000000000003", product_id: products[2].id, department: "FUSION_SWEETS", assigned_qty: 8, produced_qty: 0, priority: "normal", status: "pending", stage: "prep", correlation_id: "factory-cert-production-fusion" },
  { id: "ba4e0001-0000-4000-8000-000000000004", product_id: products[3].id, department: "BAKERY", assigned_qty: 9, produced_qty: 0, priority: "normal", status: "pending", stage: "prep", correlation_id: "factory-cert-production-bakery" },
  { id: "a0750001-0000-4000-8000-000000000005", product_id: products[4].id, department: "SEASONED_NUTS_MIXES", assigned_qty: 10, produced_qty: 0, priority: "normal", status: "pending", stage: "prep", correlation_id: "factory-cert-production-nuts" },
];
const { error: jobError } = await supabase.from("production_jobs").upsert(jobs, { onConflict: "id" });
assertNoSupabaseError(jobError, "Deterministic Production job fixture upsert failed");
const { data: seeded, error: seededError } = await supabase.from("production_jobs")
  .select("id,canonical_department,status,assigned_qty,produced_qty,priority,correlation_id")
  .like("correlation_id", "factory-cert-production-%").order("correlation_id", { ascending: true });
assertNoSupabaseError(seededError, "Seeded Production job verification read failed");
if (!Array.isArray(seeded) || seeded.length !== jobs.length) throw new Error(`Expected ${jobs.length} seeded Production jobs`);
const expectedDepartments = new Set(["ARABIC_SWEETS", "CHOCOLATES_CONFECTIONERY", "FUSION_SWEETS", "BAKERY", "SEASONED_NUTS_MIXES"]);
for (const row of seeded) {
  if (!expectedDepartments.has(String(row.canonical_department))) throw new Error(`Seeded job ${row.id} has unexpected canonical department ${row.canonical_department}`);
  if (row.status !== "pending" || row.priority !== "normal") throw new Error(`Seeded job ${row.id} did not retain pending/normal fixture state`);
}
const golden = seeded.find((row) => String(row.id).slice(0, 8).toUpperCase() === "E3ED28B0");
if (!golden || Number(golden.assigned_qty) !== 6 || Number(golden.produced_qty ?? 0) !== 0) throw new Error("Golden E3ED28B0 fixture state invalid");
console.log(`Seeded ${seeded.length} deterministic Production-TV jobs; golden short id E3ED28B0 is present.`);

const GOLDEN_ORDER_COMPANY_ID = "30000000-0000-4000-8000-000000000001";
const GOLDEN_ORDER_ID = "30000000-0000-4000-8000-000000000002";
const GOLDEN_ORDER_ITEM_ID = "30000000-0000-4000-8000-000000000003";
const GOLDEN_ORDER_FG_COMPONENT_PRODUCT_ID = products[0].id;
const GOLDEN_ORDER_3PGS_COMPONENT_PRODUCT_ID = "20000000-0000-4000-8000-000000000201";

const { error: goldenCompanyError } = await supabase.from("companies").upsert({
  id: GOLDEN_ORDER_COMPANY_ID,
  business_name: "Factory FACT-E2E Golden Order Co",
  gst_number: "07AACCF0001A1Z6",
  registered_address: "New Delhi",
  status: "approved",
  payment_terms: "prepaid",
  is_frozen: false,
}, { onConflict: "id" });
assertNoSupabaseError(goldenCompanyError, "Golden-order company fixture upsert failed");

const { error: pricingError } = await supabase.from("product_pricing_rules").insert({
  product_id: GOLDEN_ORDER_FG_COMPONENT_PRODUCT_ID,
  price_channel: "b2b",
  approval_status: "approved",
  base_price: 100,
  calculated_price: 100,
  currency: "INR",
  uom: "kg",
  gst_rate: 0,
  tax_inclusive: true,
});
assertNoSupabaseError(pricingError, "Golden-order B2B pricing fixture insert failed");
const { error: moqError } = await supabase.from("product_moq_rules").insert({
  product_id: GOLDEN_ORDER_FG_COMPONENT_PRODUCT_ID,
  channel: "b2b",
  moq_applicable: true,
  moq_value: 1,
  increment_value: 1,
  min_carton_qty: 1,
});
assertNoSupabaseError(moqError, "Golden-order B2B MOQ fixture insert failed");

const buyerEmail = "factory-cert-golden-buyer@example.invalid";
const buyerPassword = `${randomBytes(24).toString("base64url")}Aa1`;
const { data: buyerAdminData, error: buyerAdminError } = await supabase.auth.admin.createUser({
  email: buyerEmail, password: buyerPassword, email_confirm: true,
  user_metadata: { factory_certification: true, golden_order_buyer: true },
});
assertNoSupabaseError(buyerAdminError, "Golden-order buyer Auth Admin createUser failed");
const buyerId = buyerAdminData?.user?.id;
if (!buyerId) throw new Error("Golden-order buyer Auth Admin API did not return an id");
const { error: buyerUserError } = await supabase.from("users").upsert({
  id: buyerId, email: buyerEmail, full_name: "Factory Cert Golden Buyer", role: "b2b_buyer",
  company_id: GOLDEN_ORDER_COMPANY_ID, is_active: true, invite_status: "active",
}, { onConflict: "id" });
assertNoSupabaseError(buyerUserError, "Golden-order buyer public.users upsert failed");
const { error: buyerProfileError } = await supabase.from("profiles").upsert({
  id: buyerId, email: buyerEmail, role: "b2b_buyer", company_id: GOLDEN_ORDER_COMPANY_ID,
  is_approved: true, status: "approved",
}, { onConflict: "id" });
assertNoSupabaseError(buyerProfileError, "Golden-order buyer public.profiles upsert failed");

// The test deliberately uses stable ids so every downstream custody assertion
// can identify the same order/item without seeding a business-transition row.
// We therefore alter only the UUID defaults in this disposable database for
// the duration of the governed checkout. Core's submit_customer_order_v1 still
// performs the actual INSERT under its private creation scope, numbering,
// snapshot, pricing, MOQ and idempotency authority. Defaults are restored in a
// finally block before any Factory transition executes.
runLocalPostgresRoleStatement(localDbUrl,
  `ALTER TABLE public.orders ALTER COLUMN id SET DEFAULT '${GOLDEN_ORDER_ID}'::uuid;\nALTER TABLE public.order_items ALTER COLUMN id SET DEFAULT '${GOLDEN_ORDER_ITEM_ID}'::uuid;`,
  "Bind deterministic golden-order UUID defaults");
let checkoutRows;
try {
  const buyerClient = createClient(localSupabaseOrigin, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { error: buyerSignInError } = await buyerClient.auth.signInWithPassword({ email: buyerEmail, password: buyerPassword });
  assertNoSupabaseError(buyerSignInError, "Golden-order buyer sign-in failed");
  const { data: draftLineRows, error: draftLineError } = await buyerClient.rpc("add_customer_order_draft_line_v1", {
    p_product_id: GOLDEN_ORDER_FG_COMPONENT_PRODUCT_ID, p_quantity: 5,
  });
  assertNoSupabaseError(draftLineError, "Golden-order governed draft-line creation failed");
  if (!Array.isArray(draftLineRows) || draftLineRows.length !== 1 || draftLineRows[0]?.readiness_status !== "ready") {
    throw new Error(`Golden-order Buyer draft did not become ready: ${JSON.stringify(draftLineRows)}`);
  }
  const { data, error: checkoutError } = await buyerClient.rpc("submit_customer_order_v1", {
    p_idempotency_key: "factory-cert-golden-order-checkout-v1", p_requested_dispatch_date: null,
  });
  assertNoSupabaseError(checkoutError, "Golden-order governed Buyer checkout failed");
  checkoutRows = data;
  await buyerClient.auth.signOut();
} finally {
  runLocalPostgresRoleStatement(localDbUrl,
    "ALTER TABLE public.orders ALTER COLUMN id SET DEFAULT gen_random_uuid();\nALTER TABLE public.order_items ALTER COLUMN id SET DEFAULT gen_random_uuid();",
    "Restore canonical UUID defaults after golden-order checkout");
}
if (!Array.isArray(checkoutRows) || checkoutRows.length !== 1 || checkoutRows[0]?.order_id !== GOLDEN_ORDER_ID || !checkoutRows[0]?.order_number || checkoutRows[0]?.is_duplicate_submission) {
  throw new Error(`Golden-order governed Buyer checkout returned invalid facts: ${JSON.stringify(checkoutRows)}`);
}
const { data: goldenItems, error: goldenItemsError } = await supabase.from("order_items")
  .select("id,order_id,product_id,quantity").eq("order_id", GOLDEN_ORDER_ID).eq("product_id", GOLDEN_ORDER_FG_COMPONENT_PRODUCT_ID);
assertNoSupabaseError(goldenItemsError, "Golden-order item verification read failed");
if (!Array.isArray(goldenItems) || goldenItems.length !== 1 || goldenItems[0].id !== GOLDEN_ORDER_ITEM_ID || Number(goldenItems[0].quantity) !== 5) {
  throw new Error(`Golden-order governed checkout did not create the deterministic quantity-5 item: ${JSON.stringify(goldenItems)}`);
}
await appendFile(credentialFile, `export FACTORY_CERT_GOLDEN_ORDER_ID='${GOLDEN_ORDER_ID}'\nexport FACTORY_CERT_GOLDEN_ORDER_ITEM_ID='${GOLDEN_ORDER_ITEM_ID}'\n`, { encoding: "utf8" });
console.log(`Created governed deterministic golden Sales Order ${checkoutRows[0].order_number} through Buyer checkout.`);

const { error: pkgProductError } = await supabase.from("products").upsert({
  id: GOLDEN_ORDER_3PGS_COMPONENT_PRODUCT_ID, name: "Factory Cert 3PGS Gift Packaging",
  category: "packaging", sku: "CERT-3PGS-PKG-001", hsn_code: "4819",
}, { onConflict: "id" });
assertNoSupabaseError(pkgProductError, "Golden-order 3PGS packaging product fixture upsert failed");
const { error: fgBalanceError } = await supabase.from("inventory_stock_balances").upsert({
  product_id: GOLDEN_ORDER_FG_COMPONENT_PRODUCT_ID, sku: "CERT-ARABIC-001", location_code: "FINISHED_GOODS", available_qty: 2, reserved_qty: 0,
}, { onConflict: "product_id,sku,location_code" });
assertNoSupabaseError(fgBalanceError, "Golden-order FINISHED_GOODS stock-balance fixture upsert failed");
const { error: pkgBalanceError } = await supabase.from("inventory_stock_balances").upsert({
  product_id: GOLDEN_ORDER_3PGS_COMPONENT_PRODUCT_ID, sku: "CERT-3PGS-PKG-001", location_code: "3PGS", available_qty: 0, reserved_qty: 0,
}, { onConflict: "product_id,sku,location_code" });
assertNoSupabaseError(pkgBalanceError, "Golden-order 3PGS stock-balance fixture upsert failed");
console.log("Seeded FACT-E2E prerequisite company/catalogue/stock and a governed Buyer-created golden order.");

// Prerequisite master/reference data (never a business-transition row) for the
// full governed 3PGS-inward and Assembly-output receiving chains: Core's
// can_access_b2b_inventory_store() requires an explicit
// b2b_inventory_store_assignments row for any role not in its global
// SUPER_ADMIN/ADMIN/OPERATIONS_MANAGER/INVENTORY_MANAGER allowlist, and
// allocate/confirm_b2b_inventory_putaway require a real, active
// b2b_inventory_bins row for the destination store. 'manage' authority
// covers both the 'receive' check (accept_b2b_inventory_receipt) and the
// 'manage' check (finalise_b2b_inventory_grn / link_procurement_receipt) --
// see can_access_b2b_inventory_store's own OR clause.
const { data: storeThirdPartyUser, error: storeThirdPartyUserError } = await supabase
  .from("users").select("id").ilike("role", "store_3rd_party").like("email", "factory-cert-%").limit(1).maybeSingle();
assertNoSupabaseError(storeThirdPartyUserError, "STORE_3RD_PARTY identity lookup failed");
if (!storeThirdPartyUser?.id) throw new Error("STORE_3RD_PARTY disposable identity not found; create-test-identities.mjs must run first");
const { data: storeReadyGoodsUser, error: storeReadyGoodsUserError } = await supabase
  .from("users").select("id").ilike("role", "store_ready_goods").like("email", "factory-cert-%").limit(1).maybeSingle();
assertNoSupabaseError(storeReadyGoodsUserError, "STORE_READY_GOODS identity lookup failed");
if (!storeReadyGoodsUser?.id) throw new Error("STORE_READY_GOODS disposable identity not found; create-test-identities.mjs must run first");

const { error: storeAssignmentsError } = await supabase.from("b2b_inventory_store_assignments").upsert([
  { user_id: storeThirdPartyUser.id, store_code: "3PGS", authority: "manage" },
  { user_id: storeReadyGoodsUser.id, store_code: "FINISHED_GOODS", authority: "manage" },
], { onConflict: "user_id,store_code" });
assertNoSupabaseError(storeAssignmentsError, "Golden-order inventory store assignment fixture upsert failed");

const { error: binsError } = await supabase.from("b2b_inventory_bins").upsert([
  { store_code: "3PGS", zone_code: "A", rack_code: "1", shelf_code: "1", bin_code: "FACT-E2E-3PGS-BIN-01", storage_class: "ambient", active: true },
  { store_code: "FINISHED_GOODS", zone_code: "A", rack_code: "1", shelf_code: "1", bin_code: "FACT-E2E-FG-BIN-01", storage_class: "ambient", active: true },
], { onConflict: "store_code,bin_code" });
assertNoSupabaseError(binsError, "Golden-order inventory bin fixture upsert failed");
console.log("Seeded FACT-E2E prerequisite 3PGS/FINISHED_GOODS store assignments and put-away bins.");