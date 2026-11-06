#!/usr/bin/env node
/**
 * Stage 1 of the disposable Buyer-to-Dispatch journey (non-production, loopback Supabase only).
 *
 * A synthetic Buyer authenticates through real disposable Supabase Auth (no MSG91 / external provider), reads the
 * governed published catalogue, builds a cart through the governed draft RPCs, obtains Core's authoritative checkout
 * quote and submits through Core's quoted checkout authority. The REAL generated order id is captured and handed to the
 * existing governed Point38 chain by overriding FACTORY_CERT_POINT38_ORDER_ID / _ITEM_ID in the disposable credential
 * file. Finance then creates the PI through Core's PI authority (issuance, payment, clearance, dispatch etc. follow in
 * the downstream scripts).
 *
 * Nothing here inserts or updates orders, drafts, commercial versions or PI rows directly. The only service-role action
 * is resetting the disposable Buyer's own Auth password so the Buyer can sign in; the Buyer account itself was
 * created by the shared Factory fixture.
 */
import { appendFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import {
  assertLoopbackHttpOrigin,
  assertNoError,
  firstRow,
  parseCredentialFile,
  readCredential,
  requireBootstrapEnv,
} from "../point100-certification/point38-bootstrap-common.mjs";
import { recordPhase, setLedgerOrder } from "./journey-ledger.mjs";
import { SUPPORTED_DEPARTMENTS } from "./governed-production-leg.mjs";
import { randomBytes } from "node:crypto";

const LABEL = "JOURNEY";
const BUYER_EMAIL = "factory-cert-point38-buyer@example.invalid";
const credentials = parseCredentialFile();
const backendUrl = assertLoopbackHttpOrigin(requireBootstrapEnv("FACTORY_CERT_SUPABASE_URL", LABEL), LABEL);
const anonKey = requireBootstrapEnv("FACTORY_CERT_SUPABASE_ANON_KEY", LABEL);
const serviceKey = requireBootstrapEnv("FACTORY_CERT_LOCAL_SERVICE_ROLE_KEY", LABEL);
const runKey = `journey-${Date.now()}`;

const newClient = (key) =>
  createClient(backendUrl, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
const admin = newClient(serviceKey);
const buyer = newClient(anonKey);

// --- P1 Buyer authentication (disposable Auth only) -------------------------------------------------------------
const { data: buyerRow, error: buyerLookupError } = await admin.from("users").select("id").eq("email", BUYER_EMAIL).maybeSingle();
assertNoError(buyerLookupError, "Journey Buyer lookup");
if (!buyerRow?.id) throw new Error("JOURNEY_BUYER_FIXTURE_MISSING: the shared Factory fixture did not create the synthetic Buyer");
const buyerPassword = `${randomBytes(24).toString("base64url")}Aa1`;
const { error: resetError } = await admin.auth.admin.updateUserById(buyerRow.id, { password: buyerPassword });
assertNoError(resetError, "Journey disposable Buyer password reset");
const { error: signInError } = await buyer.auth.signInWithPassword({ email: BUYER_EMAIL, password: buyerPassword });
assertNoError(signInError, "Journey Buyer sign-in");
recordPhase("Buyer authenticates via disposable Supabase Auth", "BUYER", "auth.signInWithPassword", { buyerUserId: buyerRow.id });

// --- P2 published catalogue ----------------------------------------------------------------------------------------
const published = await buyer.rpc("published_products_v1");
assertNoError(published.error, "Journey published catalogue");
const publishedRows = published.data ?? [];
if (!Array.isArray(publishedRows) || publishedRows.length === 0) throw new Error("JOURNEY_CATALOGUE_EMPTY: published_products_v1 returned no products");
const prices = await buyer.rpc("buyer_product_prices_v1");
assertNoError(prices.error, "Journey Buyer prices");
const pricedIds = new Set((prices.data ?? []).map((row) => String(row.product_id ?? row.id ?? "")));
recordPhase("Buyer reads the governed published catalogue", "BUYER", "published_products_v1 + buyer_product_prices_v1", {
  publishedCount: publishedRows.length,
  pricedCount: pricedIds.size,
});

// --- P3 cart (governed draft) ----------------------------------------------------------------------------------------
const clear = await buyer.rpc("clear_customer_order_draft_v1");
assertNoError(clear.error, "Journey clear draft");
let chosen = null;
let orderedRows = [...publishedRows].sort((a, b) => Number(b.sku === "CERT-ARABIC-001") - Number(a.sku === "CERT-ARABIC-001"));
if (process.env.JOURNEY_CORE_CONTRACTS === "combined") {
  // Core #483 derives completion from production accepted by RGS; a line already covered by finished-goods stock cannot be
  // completed from that evidence (reservation -> issue evidence is not recognised yet). Choose a producible, stock-free
  // product and log every candidate so the choice is auditable; never alter stock to make one qualify.
  const candidates = [];
  for (const row of orderedRows) {
    const productId = String(row.product_id ?? "");
    const { data: stock } = await admin.from("inventory_stock_balances").select("available_qty,reserved_qty,picked_qty").eq("product_id", productId).eq("location_code", "FINISHED_GOODS");
    const onHand = (stock ?? []).reduce((sum, r) => sum + Number(r.available_qty ?? 0) + Number(r.reserved_qty ?? 0) + Number(r.picked_qty ?? 0), 0);
    const { data: prod } = await admin.from("products").select("sku,production_department").eq("id", productId).maybeSingle();
    candidates.push({ productId, sku: prod?.sku ?? row.sku ?? null, department: prod?.production_department ?? null, finishedGoodsOnHand: onHand });
  }
  console.log(`JOURNEY product candidates: ${JSON.stringify(candidates)}`);
  const eligible = new Set(candidates.filter((c) => SUPPORTED_DEPARTMENTS.has(String(c.department ?? "").toLowerCase()) && c.finishedGoodsOnHand === 0).map((c) => c.productId));
  orderedRows = orderedRows.filter((row) => eligible.has(String(row.product_id ?? "")));
  if (orderedRows.length === 0) {
    throw new Error(`JOURNEY_PRODUCTION_BLOCKED_NO_STOCKLESS_PRODUCT: no published, priced product with a fixture production role and zero finished-goods stock exists in the fixture (candidates ${JSON.stringify(candidates)}); Core #483 cannot complete a stock-covered line`);
  }
}
for (const row of orderedRows) {
  const productId = String(row.product_id ?? "");
  if (!productId || (pricedIds.size > 0 && !pricedIds.has(productId))) continue;
  const added = await buyer.rpc("add_customer_order_draft_line_v1", { p_product_id: productId, p_quantity: 4 });
  const rows = added.data;
  if (!added.error && Array.isArray(rows) && rows.length === 1 && rows[0]?.readiness_status === "ready") {
    chosen = { productId, sku: row.sku ?? null };
    break;
  }
  await buyer.rpc("clear_customer_order_draft_v1");
}
if (!chosen) throw new Error("JOURNEY_NO_ORDERABLE_PRODUCT: no published, priced product produced a ready draft at quantity 4");
const draft = await buyer.rpc("get_customer_order_draft_v1");
assertNoError(draft.error, "Journey read draft");
recordPhase("Buyer builds the cart through the governed draft", "BUYER", "add_customer_order_draft_line_v1", chosen);

// --- P4 authoritative quote + governed checkout -------------------------------------------------------------------------
const quoteResult = await buyer.rpc("customer_checkout_quote_v1");
assertNoError(quoteResult.error, "Journey authoritative checkout quote");
const quote = quoteResult.data;
if (!quote?.fingerprint || !/^[0-9a-f]{32}$/.test(String(quote.fingerprint))) throw new Error(`JOURNEY_QUOTE_INVALID: ${JSON.stringify(quote)}`);
const submitted = await buyer.rpc("submit_customer_order_quoted_v1", {
  p_idempotency_key: `${runKey}-checkout`,
  p_quote_fingerprint: quote.fingerprint,
  p_requested_dispatch_date: null,
});
assertNoError(submitted.error, "Journey governed quoted checkout");
const checkout = firstRow(submitted.data);
const orderId = String(checkout?.order_id ?? "");
if (!/^[0-9a-f-]{36}$/.test(orderId) || checkout?.is_duplicate_submission !== false) {
  throw new Error(`JOURNEY_CHECKOUT_INVALID: ${JSON.stringify(submitted.data)}`);
}
setLedgerOrder(orderId, { orderNumber: checkout.order_number, quote: { salesOrderValue: quote.sales_order_value, advanceRequired: quote.advance_required, fingerprint: quote.fingerprint } });
recordPhase("Buyer submits through Core quoted checkout authority", "BUYER", "customer_checkout_quote_v1 + submit_customer_order_quoted_v1", {
  orderId,
  orderNumber: checkout.order_number,
  salesOrderValue: checkout.sales_order_value,
  advanceRequired: checkout.advance_required,
});

// --- P4b assert the order Core created (read-only) ---------------------------------------------------------------------
const { data: order, error: orderError } = await admin
  .from("orders")
  .select("id,status,order_origin,checkout_snapshot,sales_order_value,advance_required,commercial_current_version")
  .eq("id", orderId)
  .maybeSingle();
assertNoError(orderError, "Journey order read-back");
if (order?.order_origin !== "CUSTOMER_APP" || order.status !== "submitted" || !Array.isArray(order.checkout_snapshot) || order.checkout_snapshot.length !== 1) {
  throw new Error(`JOURNEY_ORDER_UNEXPECTED: ${JSON.stringify(order)}`);
}
if (Number(order.sales_order_value) !== Number(quote.sales_order_value)) throw new Error("JOURNEY_ORDER_VALUE_MISMATCH: order != quote");
const { data: versions, error: versionsError } = await admin
  .from("sales_order_commercial_versions")
  .select("id,version_number,sales_order_value")
  .eq("order_id", orderId);
assertNoError(versionsError, "Journey commercial version read-back");
if (!versions?.length) throw new Error("JOURNEY_COMMERCIAL_VERSION_MISSING: checkout promotion did not capture a commercial version");
const { data: items, error: itemsError } = await admin.from("order_items").select("id,product_id,quantity").eq("order_id", orderId);
assertNoError(itemsError, "Journey order item read-back");
if (items?.length !== 1) throw new Error(`JOURNEY_ORDER_ITEM_UNEXPECTED: ${JSON.stringify(items)}`);
recordPhase("Core captured the commercial version and order lineage automatically", "CORE", "checkout promotion trigger", {
  commercialVersions: versions.length,
  orderItemId: items[0].id,
});
await buyer.auth.signOut().catch(() => undefined);

// --- P5 PI creation by Finance (real Core PI authority) ---------------------------------------------------------------
const financeEmail = readCredential(credentials, "FACTORY_CERT_FINANCE_HEAD_EMAIL", LABEL);
const financePassword = readCredential(credentials, "FACTORY_CERT_FINANCE_HEAD_PASSWORD", LABEL);
const finance = newClient(anonKey);
const { error: financeSignIn } = await finance.auth.signInWithPassword({ email: financeEmail, password: financePassword });
assertNoError(financeSignIn, "Journey Finance sign-in");
const { data: financeUser } = await finance.auth.getUser();
const actorId = financeUser.user?.id;
const pi = await finance.rpc("create_sales_order_proforma_invoice_v1", {
  p_order_id: orderId,
  p_commercial_version_id: versions[0].id,
  p_reason: "Buyer-to-Dispatch journey PI creation",
  p_source: "JOURNEY_CERTIFICATION",
  p_correlation_id: `${runKey}:pi-create`,
  p_idempotency_key: `${runKey}:pi-create`,
  p_actor_id: actorId,
});
assertNoError(pi.error, "Journey PI creation");
const piRow = firstRow(pi.data);
if (piRow?.status !== "READY_FOR_ISSUE") throw new Error(`JOURNEY_PI_UNEXPECTED: ${JSON.stringify(pi.data)}`);
await finance.auth.signOut().catch(() => undefined);
recordPhase("Finance creates the Proforma Invoice through Core PI authority", "FINANCE_HEAD", "create_sales_order_proforma_invoice_v1", { piId: piRow.pi_id });

// Hand the REAL Buyer-created order to the existing governed downstream scripts (last credential line wins).
appendFileSync(
  "/tmp/oasis-factory-certification.env",
  `export FACTORY_CERT_POINT38_ORDER_ID='${orderId}'\nexport FACTORY_CERT_POINT38_ORDER_ITEM_ID='${items[0].id}'\n`,
  { encoding: "utf8" },
);
console.log(`Journey order ${orderId} handed to the governed downstream chain.`);
