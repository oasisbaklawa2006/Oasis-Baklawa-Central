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

function certProduct({ id, name, category, sku, hsnCode, productionDepartment }) {
  return {
    id,
    product_name: name,
    name,
    category,
    sku,
    hsn_code: hsnCode,
    production_department: productionDepartment,
    is_active: true,
    visible_in_catalog: true,
    is_catalogue_ready: true,
    moq_value: 1,
    increment_value: 1,
    base_price: 100,
    price_b2b: 100,
  };
}

const products = [
  certProduct({ id: "20000000-0000-4000-8000-000000000101", name: "Factory Cert Arabic Baklawa", category: "sweets", sku: "CERT-ARABIC-001", hsnCode: "1905", productionDepartment: "arabic_sweets" }),
  certProduct({ id: "20000000-0000-4000-8000-000000000102", name: "Factory Cert Chocolate", category: "chocolates", sku: "CERT-CHOC-001", hsnCode: "1806", productionDepartment: "chocolates_confectionery" }),
  certProduct({ id: "20000000-0000-4000-8000-000000000103", name: "Factory Cert Fusion Sweet", category: "sweets", sku: "CERT-FUSION-001", hsnCode: "1905", productionDepartment: "fusion_sweets" }),
  certProduct({ id: "20000000-0000-4000-8000-000000000104", name: "Factory Cert Bakery", category: "bakery", sku: "CERT-BAKERY-001", hsnCode: "1905", productionDepartment: "bakery" }),
  certProduct({ id: "20000000-0000-4000-8000-000000000105", name: "Factory Cert Nuts", category: "nuts", sku: "CERT-NUTS-001", hsnCode: "2008", productionDepartment: "seasoned_nuts_mixes" }),
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
// Codacy requires a literal path; the guard above already rejects any other value.
await appendFile("/tmp/oasis-factory-certification.env", `export FACTORY_CERT_GOLDEN_ORDER_ID='${GOLDEN_ORDER_ID}'\nexport FACTORY_CERT_GOLDEN_ORDER_ITEM_ID='${GOLDEN_ORDER_ITEM_ID}'\n`, { encoding: "utf8" });
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

// ---- Point-37 fixture: disposable confirmed order for production-release certification ----
// Business-transition rows for the golden FACT-E2E chain must not be mutated here.
// This separate order exists only to prove Order Management confirmed → in_production.
const POINT37_ORDER_ID = "30000000-0000-4000-8000-000000000004";
const POINT37_ORDER_ITEM_ID = "30000000-0000-4000-8000-000000000005";
const point37BuyerEmail = "factory-cert-point37-buyer@example.invalid";
const point37BuyerPassword = `${randomBytes(24).toString("base64url")}Aa1`;

const { data: point37BuyerAdminData, error: point37BuyerAdminError } = await supabase.auth.admin.createUser({
  email: point37BuyerEmail,
  password: point37BuyerPassword,
  email_confirm: true,
  user_metadata: { factory_certification: true, point37_buyer: true },
});
assertNoSupabaseError(point37BuyerAdminError, "Point-37 buyer Auth Admin createUser failed");
const point37BuyerId = point37BuyerAdminData?.user?.id;
if (!point37BuyerId) throw new Error("Point-37 buyer Auth Admin API did not return an id");
const { error: point37BuyerUserError } = await supabase.from("users").upsert({
  id: point37BuyerId,
  email: point37BuyerEmail,
  full_name: "Factory Cert Point-37 Buyer",
  role: "b2b_buyer",
  company_id: GOLDEN_ORDER_COMPANY_ID,
  is_active: true,
  invite_status: "active",
}, { onConflict: "id" });
assertNoSupabaseError(point37BuyerUserError, "Point-37 buyer public.users upsert failed");
const { error: point37BuyerProfileError } = await supabase.from("profiles").upsert({
  id: point37BuyerId,
  email: point37BuyerEmail,
  role: "b2b_buyer",
  company_id: GOLDEN_ORDER_COMPANY_ID,
  is_approved: true,
  status: "approved",
}, { onConflict: "id" });
assertNoSupabaseError(point37BuyerProfileError, "Point-37 buyer public.profiles upsert failed");

runLocalPostgresRoleStatement(localDbUrl,
  `ALTER TABLE public.orders ALTER COLUMN id SET DEFAULT '${POINT37_ORDER_ID}'::uuid;\nALTER TABLE public.order_items ALTER COLUMN id SET DEFAULT '${POINT37_ORDER_ITEM_ID}'::uuid;`,
  "Bind deterministic Point-37 order UUID defaults");
let point37CheckoutRows;
try {
  const point37BuyerClient = createClient(localSupabaseOrigin, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { error: point37SignInError } = await point37BuyerClient.auth.signInWithPassword({
    email: point37BuyerEmail,
    password: point37BuyerPassword,
  });
  assertNoSupabaseError(point37SignInError, "Point-37 buyer sign-in failed");
  const { error: point37ClearDraftError } = await point37BuyerClient.rpc("clear_customer_order_draft_v1");
  assertNoSupabaseError(point37ClearDraftError, "Point-37 governed draft clear failed");
  const { data: point37DraftLineRows, error: point37DraftLineError } = await point37BuyerClient.rpc("add_customer_order_draft_line_v1", {
    p_product_id: GOLDEN_ORDER_FG_COMPONENT_PRODUCT_ID,
    p_quantity: 3,
  });
  assertNoSupabaseError(point37DraftLineError, "Point-37 governed draft-line creation failed");
  if (!Array.isArray(point37DraftLineRows) || point37DraftLineRows.length !== 1 || point37DraftLineRows[0]?.readiness_status !== "ready") {
    throw new Error(`Point-37 Buyer draft did not become ready: ${JSON.stringify(point37DraftLineRows)}`);
  }
  const { data, error: point37CheckoutError } = await point37BuyerClient.rpc("submit_customer_order_v1", {
    p_idempotency_key: "factory-cert-point37-order-checkout-v1",
    p_requested_dispatch_date: null,
  });
  assertNoSupabaseError(point37CheckoutError, "Point-37 governed Buyer checkout failed");
  point37CheckoutRows = data;
  await point37BuyerClient.auth.signOut();
} finally {
  runLocalPostgresRoleStatement(localDbUrl,
    "ALTER TABLE public.orders ALTER COLUMN id SET DEFAULT gen_random_uuid();\nALTER TABLE public.order_items ALTER COLUMN id SET DEFAULT gen_random_uuid();",
    "Restore canonical UUID defaults after Point-37 checkout");
}
if (!Array.isArray(point37CheckoutRows) || point37CheckoutRows.length !== 1 || point37CheckoutRows[0]?.order_id !== POINT37_ORDER_ID) {
  throw new Error(`Point-37 governed Buyer checkout returned invalid facts: ${JSON.stringify(point37CheckoutRows)}`);
}

// PF-6C / resolvePaymentBinding require exactly one READY_FOR_ISSUE or ISSUED PI row on the
// authority view. Governed Buyer checkout creates the commercial version but does not always
// surface a bindable PI before Finance issuance.
runLocalPostgresRoleStatement(localDbUrl,
  `DO $$
DECLARE
  v_order uuid := '${POINT37_ORDER_ID}'::uuid;
  v_version uuid;
BEGIN
  SELECT id INTO v_version
  FROM public.sales_order_commercial_versions
  WHERE order_id = v_order
  ORDER BY version_number DESC
  LIMIT 1;

  IF v_version IS NULL THEN
    v_version := public.create_sales_order_commercial_version_v1(
      v_order,
      'FACTORY_CERT',
      'factory-cert-point37-version',
      'factory-cert-point37-version-1',
      NULL
    );
  END IF;

  SET LOCAL session_replication_role = replica;
  INSERT INTO public.sales_order_proforma_invoices (
    id, order_id, commercial_version_id, commercial_version_number, status,
    frozen_commercial_snapshot, frozen_snapshot_fingerprint, reason, source,
    correlation_id, idempotency_key
  )
  SELECT
    gen_random_uuid(),
    v_order,
    v.id,
    v.version_number,
    'READY_FOR_ISSUE',
    v.commercial_snapshot,
    v.snapshot_fingerprint,
    'FACTORY_CERT_POINT37',
    'TEST',
    'factory-cert-point37-pi-ready',
    'factory-cert-point37-pi-ready-1'
  FROM public.sales_order_commercial_versions v
  WHERE v.id = v_version
    AND NOT EXISTS (
      SELECT 1
      FROM public.sales_order_proforma_invoices pi
      WHERE pi.order_id = v_order
        AND pi.status IN ('READY_FOR_ISSUE', 'ISSUED')
    );
  SET LOCAL session_replication_role = DEFAULT;
END $$;`,
  "Point-37 PI binding fixture bootstrap");

// Fixture bootstrap only: leave the order at confirmed with verified advance so OM Point-37
// can exercise release_order_to_in_production_v1 without touching the golden FACT-E2E order.
// Core's ORDER_STATUS_AUTHORITY_REQUIRED trigger rejects service-role PostgREST updates;
// disposable fixture rows use the sanctioned postgres-role path (see local-supabase-client.mjs).
const point37AdvanceRequired = Number(point37CheckoutRows[0]?.advance_required ?? 0);
const point37AdvancePaid = point37AdvanceRequired > 0 ? point37AdvanceRequired : 300;
runLocalPostgresRoleStatement(localDbUrl,
  `UPDATE public.orders
   SET status = 'confirmed',
       payment_status = 'verified_advance',
       advance_paid = ${point37AdvancePaid},
       advance_required = ${point37AdvancePaid}
   WHERE id = '${POINT37_ORDER_ID}'::uuid;`,
  "Point-37 confirmed-order fixture bootstrap");

// PF-6C clearance requires a READY_FOR_ISSUE/ISSUED PI binding on the disposable order.
runLocalPostgresRoleStatement(localDbUrl,
  `DO $$
DECLARE
  v_order uuid := '${POINT37_ORDER_ID}'::uuid;
  v_version uuid;
  v_pi_count int;
BEGIN
  SELECT id INTO v_version
  FROM public.sales_order_commercial_versions
  WHERE order_id = v_order
  ORDER BY version_number DESC
  LIMIT 1;

  IF v_version IS NULL THEN
    v_version := public.create_sales_order_commercial_version_v1(
      v_order,
      'FACTORY_CERT_POINT37',
      'factory-cert-point37-commercial',
      'factory-cert-point37-commercial-v1',
      NULL
    );
    UPDATE public.orders SET commercial_current_version = 1 WHERE id = v_order;
  END IF;

  SELECT COUNT(*) INTO v_pi_count
  FROM public.sales_order_proforma_invoices
  WHERE order_id = v_order;

  IF v_pi_count = 0 THEN
    INSERT INTO public.sales_order_proforma_invoices (
      id, order_id, commercial_version_id, commercial_version_number, status,
      frozen_commercial_snapshot, frozen_snapshot_fingerprint, reason, source,
      correlation_id, idempotency_key
    )
    SELECT
      gen_random_uuid(), v_order, v.id, v.version_number, 'READY_FOR_ISSUE',
      v.commercial_snapshot, v.snapshot_fingerprint,
      'Point-37 factory certification', 'FACTORY_CERT',
      'factory-cert-point37-pi', 'factory-cert-point37-pi-v1'
    FROM public.sales_order_commercial_versions v
    WHERE v.id = v_version;
  END IF;
END $$;`,
  "Point-37 PI binding fixture bootstrap");

await appendFile(
  "/tmp/oasis-factory-certification.env",
  `export FACTORY_CERT_POINT37_ORDER_ID='${POINT37_ORDER_ID}'\nexport FACTORY_CERT_POINT37_ORDER_ITEM_ID='${POINT37_ORDER_ITEM_ID}'\n`,
  { encoding: "utf8" },
);
console.log(`Point-37 confirmed-order fixture ready: ${point37CheckoutRows[0].order_number} @ confirmed`);

// Disposable cert bootstrap only: Core main has no release_order_to_dispatched_v1 yet.
// Point-38 Golden Pipeline finalize must use a governed SECURITY DEFINER RPC because
// trg_protect_order_authority_fields rejects authenticated orders.status PATCH.
runLocalPostgresRoleStatement(localDbUrl,
  `CREATE OR REPLACE FUNCTION public.release_order_to_dispatched_v1(
  p_order_id uuid,
  p_tracking_number text DEFAULT NULL,
  p_courier_name text DEFAULT NULL,
  p_finalize_reason text DEFAULT NULL,
  p_correlation_id text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v public.orders%ROWTYPE;
BEGIN
  PERFORM public.assert_order_transition_role('gate_release');
  SELECT * INTO v FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'blockers', jsonb_build_array(jsonb_build_object('code', 'not_found')));
  END IF;
  IF v.status IN ('dispatched', 'in_transit', 'delivered') THEN
    RETURN jsonb_build_object(
      'ok', true,
      'order_id', p_order_id,
      'previous_status', v.status,
      'new_status', v.status,
      'already_applied', true
    );
  END IF;
  IF v.status NOT IN ('cleared_for_dispatch', 'ready_for_dispatch') THEN
    RETURN jsonb_build_object(
      'ok', false,
      'blockers', jsonb_build_array(jsonb_build_object('code', 'invalid_status', 'status', v.status))
    );
  END IF;
  UPDATE public.orders
     SET status = 'dispatched',
         tracking_number = COALESCE(NULLIF(BTRIM(p_tracking_number), ''), tracking_number),
         courier_name = COALESCE(NULLIF(BTRIM(p_courier_name), ''), courier_name)
   WHERE id = p_order_id;
  INSERT INTO public.order_status_history(order_id, old_status, new_status, changed_by)
  VALUES (p_order_id, v.status, 'dispatched', auth.uid());
  INSERT INTO public.audit_logs(action_type, module_name, entity_name, entity_id, actor_id, risk_level, new_value)
  VALUES (
    'ORDER_RELEASED_TO_DISPATCHED',
    'Dispatch',
    'orders',
    p_order_id::text,
    auth.uid(),
    'high',
    jsonb_build_object('finalize_reason', p_finalize_reason, 'correlation_id', p_correlation_id)
  );
  RETURN jsonb_build_object(
    'ok', true,
    'order_id', p_order_id,
    'previous_status', v.status,
    'new_status', 'dispatched',
    'already_applied', false
  );
END $$;
REVOKE ALL ON FUNCTION public.release_order_to_dispatched_v1(uuid, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.release_order_to_dispatched_v1(uuid, text, text, text, text) TO authenticated, service_role;`,
  "Point-38 release_order_to_dispatched_v1 disposable cert RPC bootstrap");

// ---- Point-38 fixture: disposable cleared_for_dispatch order for Golden Pipeline / governance-board certification ----
// Separate from FACT-E2E golden order and Point-37 production-release order.
const POINT38_ORDER_ID = "30000000-0000-4000-8000-000000000006";
const POINT38_ORDER_ITEM_ID = "30000000-0000-4000-8000-000000000007";
const point38BuyerEmail = "factory-cert-point38-buyer@example.invalid";
const point38BuyerPassword = `${randomBytes(24).toString("base64url")}Aa1`;

const { data: point38BuyerAdminData, error: point38BuyerAdminError } = await supabase.auth.admin.createUser({
  email: point38BuyerEmail,
  password: point38BuyerPassword,
  email_confirm: true,
  user_metadata: { factory_certification: true, point38_buyer: true },
});
assertNoSupabaseError(point38BuyerAdminError, "Point-38 buyer Auth Admin createUser failed");
const point38BuyerId = point38BuyerAdminData?.user?.id;
if (!point38BuyerId) throw new Error("Point-38 buyer Auth Admin API did not return an id");
const { error: point38BuyerUserError } = await supabase.from("users").upsert({
  id: point38BuyerId,
  email: point38BuyerEmail,
  full_name: "Factory Cert Point-38 Buyer",
  role: "b2b_buyer",
  company_id: GOLDEN_ORDER_COMPANY_ID,
  is_active: true,
  invite_status: "active",
}, { onConflict: "id" });
assertNoSupabaseError(point38BuyerUserError, "Point-38 buyer public.users upsert failed");
const { error: point38BuyerProfileError } = await supabase.from("profiles").upsert({
  id: point38BuyerId,
  email: point38BuyerEmail,
  role: "b2b_buyer",
  company_id: GOLDEN_ORDER_COMPANY_ID,
  is_approved: true,
  status: "approved",
}, { onConflict: "id" });
assertNoSupabaseError(point38BuyerProfileError, "Point-38 buyer public.profiles upsert failed");

runLocalPostgresRoleStatement(localDbUrl,
  `ALTER TABLE public.orders ALTER COLUMN id SET DEFAULT '${POINT38_ORDER_ID}'::uuid;\nALTER TABLE public.order_items ALTER COLUMN id SET DEFAULT '${POINT38_ORDER_ITEM_ID}'::uuid;`,
  "Bind deterministic Point-38 order UUID defaults");
let point38CheckoutRows;
try {
  const point38BuyerClient = createClient(localSupabaseOrigin, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { error: point38SignInError } = await point38BuyerClient.auth.signInWithPassword({
    email: point38BuyerEmail,
    password: point38BuyerPassword,
  });
  assertNoSupabaseError(point38SignInError, "Point-38 buyer sign-in failed");
  const { error: point38ClearDraftError } = await point38BuyerClient.rpc("clear_customer_order_draft_v1");
  assertNoSupabaseError(point38ClearDraftError, "Point-38 governed draft clear failed");
  const { data: point38DraftLineRows, error: point38DraftLineError } = await point38BuyerClient.rpc("add_customer_order_draft_line_v1", {
    p_product_id: GOLDEN_ORDER_FG_COMPONENT_PRODUCT_ID,
    p_quantity: 4,
  });
  assertNoSupabaseError(point38DraftLineError, "Point-38 governed draft-line creation failed");
  if (!Array.isArray(point38DraftLineRows) || point38DraftLineRows.length !== 1 || point38DraftLineRows[0]?.readiness_status !== "ready") {
    throw new Error(`Point-38 Buyer draft did not become ready: ${JSON.stringify(point38DraftLineRows)}`);
  }
  const { data, error: point38CheckoutError } = await point38BuyerClient.rpc("submit_customer_order_v1", {
    p_idempotency_key: "factory-cert-point38-order-checkout-v1",
    p_requested_dispatch_date: null,
  });
  assertNoSupabaseError(point38CheckoutError, "Point-38 governed Buyer checkout failed");
  point38CheckoutRows = data;
  await point38BuyerClient.auth.signOut();
} finally {
  runLocalPostgresRoleStatement(localDbUrl,
    "ALTER TABLE public.orders ALTER COLUMN id SET DEFAULT gen_random_uuid();\nALTER TABLE public.order_items ALTER COLUMN id SET DEFAULT gen_random_uuid();",
    "Restore canonical UUID defaults after Point-38 checkout");
}
if (!Array.isArray(point38CheckoutRows) || point38CheckoutRows.length !== 1 || point38CheckoutRows[0]?.order_id !== POINT38_ORDER_ID) {
  throw new Error(`Point-38 governed Buyer checkout returned invalid facts: ${JSON.stringify(point38CheckoutRows)}`);
}

const point38AdvanceRequired = Number(point38CheckoutRows[0]?.advance_required ?? 0);
const point38AdvancePaid = point38AdvanceRequired > 0 ? point38AdvanceRequired : 400;
runLocalPostgresRoleStatement(localDbUrl,
  `DO $$
DECLARE
  v_order uuid := '${POINT38_ORDER_ID}'::uuid;
  v_version uuid;
BEGIN
  SELECT id INTO v_version
  FROM public.sales_order_commercial_versions
  WHERE order_id = v_order
  ORDER BY version_number DESC
  LIMIT 1;

  IF v_version IS NULL THEN
    v_version := public.create_sales_order_commercial_version_v1(
      v_order,
      'FACTORY_CERT_POINT38',
      'factory-cert-point38-commercial',
      'factory-cert-point38-commercial-v1',
      NULL
    );
    UPDATE public.orders SET commercial_current_version = 1 WHERE id = v_order;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.sales_order_proforma_invoices
    WHERE order_id = v_order AND status IN ('READY_FOR_ISSUE', 'ISSUED')
  ) THEN
    INSERT INTO public.sales_order_proforma_invoices (
      id, order_id, commercial_version_id, commercial_version_number, status,
      frozen_commercial_snapshot, frozen_snapshot_fingerprint, reason, source,
      correlation_id, idempotency_key
    )
    SELECT
      gen_random_uuid(), v_order, v.id, v.version_number, 'READY_FOR_ISSUE',
      v.commercial_snapshot, v.snapshot_fingerprint,
      'Point-38 factory certification', 'FACTORY_CERT',
      'factory-cert-point38-pi', 'factory-cert-point38-pi-v1'
    FROM public.sales_order_commercial_versions v
    WHERE v.id = v_version;
  END IF;
END $$;`,
  "Point-38 PI binding fixture bootstrap");

runLocalPostgresRoleStatement(localDbUrl,
  `UPDATE public.orders
   SET status = 'cleared_for_dispatch',
       payment_status = 'paid',
       payment_cleared = true,
       advance_paid = ${point38AdvancePaid},
       advance_required = ${point38AdvancePaid},
       final_invoice_url = 'https://example.invalid/factory-cert-point38-invoice'
   WHERE id = '${POINT38_ORDER_ID}'::uuid;`,
  "Point-38 cleared_for_dispatch fixture bootstrap");

const { error: point38StockError } = await supabase.from("inventory_stock_balances").upsert({
  product_id: GOLDEN_ORDER_FG_COMPONENT_PRODUCT_ID,
  sku: "CERT-ARABIC-001",
  location_code: "WH-MAIN",
  available_qty: 20,
  reserved_qty: 0,
}, { onConflict: "product_id,sku,location_code" });
assertNoSupabaseError(point38StockError, "Point-38 WH-MAIN stock-balance fixture upsert failed");

await appendFile(
  "/tmp/oasis-factory-certification.env",
  `export FACTORY_CERT_POINT38_ORDER_ID='${POINT38_ORDER_ID}'\nexport FACTORY_CERT_POINT38_ORDER_ITEM_ID='${POINT38_ORDER_ITEM_ID}'\n`,
  { encoding: "utf8" },
);
console.log(`Point-38 cleared_for_dispatch fixture ready: ${point38CheckoutRows[0].order_number} @ cleared_for_dispatch`);