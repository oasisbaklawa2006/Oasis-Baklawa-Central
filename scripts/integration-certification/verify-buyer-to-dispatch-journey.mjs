#!/usr/bin/env node
/**
 * Final read-only verification of the Buyer-to-Dispatch journey (disposable loopback Supabase only).
 * Proves the SAME Buyer-created order reached `dispatched`, that status lineage and audit trail came from Core's
 * authorities in the expected order, that financial values stayed consistent from quote to commercial version, and
 * that the Buyer was denied dispatch authority while the order was still cleared_for_dispatch (that probe runs in the
 * canonical tail, before finalization; here it is verified from the ledger). Service role is used only for READS.
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
const orderItemId = readCredential(credentials, "FACTORY_CERT_POINT38_ORDER_ITEM_ID", LABEL);
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
// The advance is part of the quote the Buyer accepted; both sides must be present and equal (a missing value is never read as zero).
const hasNumber = (value) => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
if (!hasNumber(order.advance_required) || !hasNumber(ledger.quote?.advanceRequired)) fail("JOURNEY_ADVANCE_MISSING", { order: order.advance_required, quote: ledger.quote?.advanceRequired });
if (Number(order.advance_required) !== Number(ledger.quote.advanceRequired)) fail("JOURNEY_ADVANCE_DRIFT_ORDER_VS_QUOTE", { order: order.advance_required, quote: ledger.quote.advanceRequired });
recordPhase("Final order state is dispatched for the Buyer-created order id", "CORE", "orders read-back", { orderId, orderStatus: order.status });

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
// Scope of this claim: the four pre-dispatch transitions above. Dispatch finalization is evidenced by order_status_history
// (checked above) and the immutable dispatch proof (checked below), not by an audit action verified here.
recordPhase("Audit trail records the four governed pre-dispatch transitions (manufacturing, production, packed-ready, cleared-for-dispatch)", "CORE", "audit_logs", { actions: [...actions].sort() });

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

// 5b. Governed production completion and authoritative Gate evidence are mandatory (no fallback, no BLOCKED branch).
const { data: items, error: itemsError } = await admin.from("order_items").select("id,quantity,production_status,actual_packed_qty").eq("order_id", orderId);
assertNoError(itemsError, "Journey order items read");
if (items?.length !== 1 || items[0].id !== orderItemId) fail("JOURNEY_ORDER_ITEM_NOT_THE_CHECKOUT_LINE", { expectedOrderItemId: orderItemId, items });
const item = items[0];
if (item.production_status !== "completed" || Number(item.actual_packed_qty) !== Number(item.quantity)) fail("JOURNEY_ITEM_NOT_GOVERNED_COMPLETE", items);
const { data: completions, error: completionError } = await admin.from("order_item_production_completions").select("outcome,packed_qty,evidence").eq("order_item_id", item.id).order("created_at");
assertNoError(completionError, "Journey completion events read");
const { data: unsupported, error: unsupportedError } = await admin.from("audit_logs").select("id").eq("entity_id", orderId).eq("action_type", "PACKED_READY_WITHOUT_GOVERNED_PRODUCTION_EVIDENCE");
// A failed read must fail verification: only a SUCCESSFUL empty result proves nothing was promoted without evidence.
assertNoError(unsupportedError, "Journey unsupported packed-ready promotion audit read");
const outcomes = (completions ?? []).map((row) => row.outcome);
if (outcomes.join(",") !== "PARTIAL,COMPLETE") fail("JOURNEY_COMPLETION_EVENTS_UNEXPECTED", completions);
if (Number(completions.at(-1).packed_qty) !== Number(item.quantity)) fail("JOURNEY_COMPLETION_QTY_MISMATCH", completions);
if (!Array.isArray(completions.at(-1).evidence?.transfer_ids) || completions.at(-1).evidence.transfer_ids.length < 2) fail("JOURNEY_COMPLETION_EVIDENCE_THIN", completions.at(-1).evidence);
if (unsupported?.length) fail("JOURNEY_PACKED_READY_WITHOUT_EVIDENCE_AUDITED", unsupported);
const { data: scans } = await admin.from("operational_scan_records").select("id,scan_source,actor_role,metadata,verification_status").eq("order_id", orderId).eq("scan_type", "dispatch_gate");
if (scans?.length !== 1 || scans[0].scan_source !== "B2B_GATE_SCAN_V1" || scans[0].metadata?.authority !== "B2B_GATE_SCAN_V1" || scans[0].actor_role !== "GATE_SECURITY") fail("JOURNEY_GATE_EVIDENCE_NOT_AUTHORITATIVE", scans);
recordPhase("Governed completion events (PARTIAL then COMPLETE) and authoritative Gate evidence are present; nothing was packed-ready without evidence", "CORE", "order_item_production_completions + operational_scan_records", { outcomes, gateScanSource: scans[0].scan_source });

// 6. Authorization boundary preserved: the Buyer denial was exercised by the canonical tail while the order was still
// cleared_for_dispatch (finalization otherwise possible). Verify it was recorded, with Core's specific actor denial,
// BEFORE the Dispatch Manager finalized, and that the order state was unchanged by it.
const ledgerAfter = readLedger();
const names = ledgerAfter.phases.map((phase) => phase.name);
const buyerIndex = names.findIndex((name) => name.startsWith("Buyer is rejected from dispatch authority at cleared_for_dispatch"));
const finalizeIndex = names.findIndex((name) => name === "Dispatch finalizes the order through the canonical Core RPC");
if (buyerIndex < 0) fail("JOURNEY_BUYER_DENIAL_PROBE_MISSING", { phases: names });
if (finalizeIndex < 0 || buyerIndex > finalizeIndex) fail("JOURNEY_BUYER_DENIAL_NOT_BEFORE_FINALIZATION", { buyerIndex, finalizeIndex });
const buyerPhase = ledgerAfter.phases.find((phase) => phase.name.startsWith("Buyer is rejected from dispatch authority at cleared_for_dispatch"));
if (!String(buyerPhase.rejection ?? "").includes("DISPATCH_FINALIZATION_ACTOR_REQUIRED") || String(buyerPhase.orderStatusAfter ?? "").toLowerCase() !== "cleared_for_dispatch") {
  fail("JOURNEY_BUYER_DENIAL_NOT_AUTHORITY_SPECIFIC", buyerPhase);
}
recordPhase("Buyer denial verified: Core's dispatch actor check rejected the Buyer before finalization; order state unchanged", "CORE", "ledger (probe executed in the canonical tail)", { rejection: buyerPhase.rejection });

console.log(`JOURNEY COMPLETE: order ${orderId} (${ledger.orderNumber}) Buyer -> dispatched; ${readLedger().phases.length} phases PASS.`);
