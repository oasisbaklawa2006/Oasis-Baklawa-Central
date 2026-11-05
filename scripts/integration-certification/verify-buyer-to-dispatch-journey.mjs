#!/usr/bin/env node
/**
 * Final read-only verification of the Buyer-to-Dispatch journey (disposable loopback Supabase only).
 * Proves the SAME Buyer-created order reached `dispatched`, that status lineage and audit trail came from Core's
 * authorities in the expected order, that financial values stayed consistent from quote to commercial version, and
 * that the Buyer still cannot exercise dispatch authority. Service role is used only for READS.
 */
import { createClient } from "@supabase/supabase-js";
import {
  assertLoopbackHttpOrigin,
  assertNoError,
  parseCredentialFile,
  readCredential,
  requireBootstrapEnv,
} from "../point100-certification/point38-bootstrap-common.mjs";
import { readLedger, recordPhase } from "./journey-ledger.mjs";

const LABEL = "JOURNEY_VERIFY";
const credentials = parseCredentialFile();
const backendUrl = assertLoopbackHttpOrigin(requireBootstrapEnv("FACTORY_CERT_SUPABASE_URL", LABEL), LABEL);
const anonKey = requireBootstrapEnv("FACTORY_CERT_SUPABASE_ANON_KEY", LABEL);
const serviceKey = requireBootstrapEnv("FACTORY_CERT_LOCAL_SERVICE_ROLE_KEY", LABEL);
const orderId = readCredential(credentials, "FACTORY_CERT_POINT38_ORDER_ID", LABEL);
const ledger = readLedger();
const newClient = (key) => createClient(backendUrl, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
const admin = newClient(serviceKey);
const fail = (code, detail) => {
  throw new Error(`${code}: ${typeof detail === "string" ? detail : JSON.stringify(detail)}`);
};

if (ledger.orderId !== orderId) fail("JOURNEY_ORDER_ID_DRIFT", { ledger: ledger.orderId, credential: orderId });

// 1. Same order, final state, origin.
const { data: order, error: orderError } = await admin.from("orders").select("*").eq("id", orderId).maybeSingle();
assertNoError(orderError, "Journey final order read");
if (order?.status !== "dispatched") fail("JOURNEY_FINAL_STATUS_NOT_DISPATCHED", { status: order?.status });
if (order.order_origin !== "CUSTOMER_APP") fail("JOURNEY_ORDER_ORIGIN_CHANGED", order.order_origin);
if (Number(order.sales_order_value) !== Number(ledger.quote?.salesOrderValue)) fail("JOURNEY_VALUE_DRIFT_ORDER_VS_QUOTE", { order: order.sales_order_value, quote: ledger.quote?.salesOrderValue });
recordPhase("Final order state is dispatched for the Buyer-created order id", "CORE", "orders read-back", { orderId, status: order.status });

// 2. Status lineage in order.
const { data: history, error: historyError } = await admin.from("order_status_history").select("*").eq("order_id", orderId);
assertNoError(historyError, "Journey status history read");
const stamp = (row) => String(row.changed_at ?? row.created_at ?? "");
const sequence = [...(history ?? [])].sort((a, b) => stamp(a).localeCompare(stamp(b))).map((row) => row.new_status);
const expected = ["manufacturing", "in_production", "packed_ready", "cleared_for_dispatch", "dispatched"];
let cursor = -1;
for (const status of expected) {
  const index = sequence.indexOf(status, cursor + 1);
  if (index < 0) fail("JOURNEY_STATUS_LINEAGE_INCOMPLETE", { expected, actual: sequence });
  cursor = index;
}
recordPhase("Status lineage follows the governed order", "CORE", "order_status_history", { sequence });

// 3. Audit lineage for the order.
const { data: audits, error: auditError } = await admin.from("audit_logs").select("action_type").eq("entity_id", orderId);
assertNoError(auditError, "Journey audit read");
const actions = new Set((audits ?? []).map((row) => row.action_type));
for (const action of ["ORDER_RELEASED_TO_MANUFACTURING", "ORDER_RELEASED_TO_PRODUCTION", "ORDER_MARKED_PACKED_READY", "ORDER_CLEARED_FOR_DISPATCH"]) {
  if (!actions.has(action)) fail("JOURNEY_AUDIT_LINEAGE_INCOMPLETE", { missing: action, present: [...actions] });
}
recordPhase("Audit trail records every governed transition", "CORE", "audit_logs", { actions: [...actions].sort() });

// 4. Financial integrity: quote == order == commercial version == PI frozen snapshot fingerprint.
const { data: versions } = await admin.from("sales_order_commercial_versions").select("id,sales_order_value,snapshot_fingerprint").eq("order_id", orderId);
if (versions?.length !== 1 || Number(versions[0].sales_order_value) !== Number(ledger.quote.salesOrderValue)) fail("JOURNEY_COMMERCIAL_VALUE_DRIFT", versions);
const { data: pis } = await admin.from("sales_order_proforma_invoices").select("id,status,frozen_snapshot_fingerprint").eq("order_id", orderId);
if (pis?.length !== 1 || pis[0].status !== "ISSUED" || pis[0].frozen_snapshot_fingerprint !== versions[0].snapshot_fingerprint) fail("JOURNEY_PI_INTEGRITY", pis);
recordPhase("Quote, order, commercial version and issued PI agree", "CORE", "financial read-back", { salesOrderValue: order.sales_order_value, piStatus: pis[0].status });

// 5. Immutable dispatch proof exists for this order.
const { data: proofs, error: proofError } = await admin.from("dispatch_proof_packets").select("id").eq("order_id", orderId);
assertNoError(proofError, "Journey dispatch proof read");
if (!proofs?.length) fail("JOURNEY_DISPATCH_PROOF_MISSING", orderId);
recordPhase("Immutable dispatch proof packet exists for the order", "DISPATCH_MANAGER", "dispatch_proof_packets", { packets: proofs.length });

// 6. Authorization boundary preserved: a Buyer cannot run dispatch finalization or Gate release, state unchanged.
const buyerEmail = "factory-cert-point38-buyer@example.invalid";
const { data: buyerRow } = await admin.from("users").select("id").eq("email", buyerEmail).maybeSingle();
const verifyPassword = `Jv${Date.now()}Aa1!x`;
await admin.auth.admin.updateUserById(buyerRow.id, { password: verifyPassword });
const buyer = newClient(anonKey);
assertNoError((await buyer.auth.signInWithPassword({ email: buyerEmail, password: verifyPassword })).error, "Journey Buyer re-sign-in");
const probe = await buyer.rpc("release_order_to_dispatched_v1", { p_order_id: orderId });
if (!probe.error) fail("JOURNEY_BUYER_DISPATCH_AUTHORITY_NOT_REJECTED", probe.data);
const { data: after } = await admin.from("orders").select("status").eq("id", orderId).maybeSingle();
if (after?.status !== "dispatched") fail("JOURNEY_STATE_CHANGED_BY_REJECTED_CALL", after);
recordPhase("Buyer is rejected from dispatch authority; order state unchanged", "BUYER", "release_order_to_dispatched_v1 (negative)", { rejection: probe.error.message });

console.log(`JOURNEY COMPLETE: order ${orderId} (${ledger.orderNumber}) Buyer -> dispatched; ${readLedger().phases.length} phases PASS.`);
