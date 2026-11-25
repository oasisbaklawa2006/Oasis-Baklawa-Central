/**
 * Governed production leg for the Buyer-to-Dispatch journey (Core #483 contract; disposable loopback Supabase only).
 *
 * Replaces the earlier staff write to order_items.production_status/actual_packed_qty with Core's intended pipeline:
 *   reserve_rgs_stock -> create_production_shortage_demand -> accept/start/advance/record output/declare ready
 *   (Production role) -> dispatch_production_to_rgs -> record_rgs_receipt -> accept_rgs_production_receipt (RGS, the
 *   QC/stock acceptance) -> complete_order_item_from_production_v1 (Operations authority).
 * Two production jobs are used so the journey proves, on real records, that rejected quantity is excluded, a partial
 * acceptance yields a PARTIAL completion, a retry is idempotent, and only fully accepted quantity completes the line.
 *
 * Nothing here writes a business table directly. If the pipeline cannot produce the accepted evidence (for example the
 * line is already covered by finished-goods stock, which #483 does not yet recognise) the leg stops with an explicit
 * JOURNEY_PRODUCTION_BLOCKED_* error instead of fabricating completion evidence.
 */
import { createClient } from "@supabase/supabase-js";
import {
  assertLoopbackHttpOrigin,
  assertNoError,
  firstRow,
  parseCredentialFile,
  readCredential,
  requireBootstrapEnv,
} from "../point100-certification/point38-bootstrap-common.mjs";
import { recordPhase } from "./journey-ledger.mjs";

const LABEL = "JOURNEY_PRODUCTION";
/** Production departments the disposable fixture has a production role for (production_department -> RGS source + role). */
export const SUPPORTED_DEPARTMENTS = new Map([
  ["arabic_sweets", { source: "ARABIC_SWEETS", role: "PROD_ARABIC_SWEETS" }],
  ["bakery", { source: "BAKERY", role: "PROD_BAKERY" }],
  ["chocolates_confectionery", { source: "CHOCOLATES_CONFECTIONERY", role: "PROD_CHOCOLATE" }],
  ["fusion_sweets", { source: "FUSION_SWEETS", role: "PROD_FUSION" }],
  ["seasoned_nuts_mixes", { source: "SEASONED_NUTS_MIXES", role: "PROD_NUTS" }],
]);

async function signIn(role, credentials, backendUrl, anonKey) {
  const client = createClient(backendUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const email = readCredential(credentials, `FACTORY_CERT_${role}_EMAIL`, LABEL);
  const password = readCredential(credentials, `FACTORY_CERT_${role}_PASSWORD`, LABEL);
  assertNoError((await client.auth.signInWithPassword({ email, password })).error, `Journey ${role} sign-in`);
  return client;
}

export async function runGovernedProductionLeg({ orderId, orderItem, adminClient, dispatchClient }) {
  const credentials = parseCredentialFile();
  const backendUrl = assertLoopbackHttpOrigin(requireBootstrapEnv("FACTORY_CERT_SUPABASE_URL", LABEL), LABEL);
  const anonKey = requireBootstrapEnv("FACTORY_CERT_SUPABASE_ANON_KEY", LABEL);
  const quantity = Number(orderItem.quantity);
  if (!Number.isInteger(quantity) || quantity < 2) throw new Error(`JOURNEY_PRODUCTION_BLOCKED_QUANTITY: need an integral quantity >= 2, got ${quantity}`);

  const { data: product, error: productError } = await adminClient.from("products").select("id,sku,production_department").eq("id", orderItem.product_id).maybeSingle();
  assertNoError(productError, "Journey product read");
  const department = SUPPORTED_DEPARTMENTS.get(String(product?.production_department ?? "").toLowerCase());
  if (!department || !product?.sku) {
    throw new Error(`JOURNEY_PRODUCTION_BLOCKED_DEPARTMENT: the disposable fixture has no production role for department "${product?.production_department}"`);
  }
  const prod = await signIn(department.role, credentials, backendUrl, anonKey);
  const store = await signIn("STORE_READY_GOODS", credentials, backendUrl, anonKey);
  const suffix = `${Date.now()}`;

  // 1. Reservation: the order line asks RGS for finished goods; the shortfall becomes production demand.
  const reservation = await adminClient.rpc("reserve_rgs_stock", {
    p_reservation_number: `JRN-RES-${suffix}`, p_order_id: orderId, p_product_id: product.id, p_sku: product.sku,
    p_requested_qty: quantity, p_source_department: department.source, p_correlation_id: `journey-${suffix}-reserve`,
  });
  assertNoError(reservation.error, "Journey RGS reservation");
  let reservationRow = firstRow(reservation.data);
  if (!reservationRow?.id) {
    const { data: looked, error: lookError } = await adminClient.from("inventory_reservations").select("id,reserved_qty").eq("correlation_id", `journey-${suffix}-reserve`).maybeSingle();
    assertNoError(lookError, "Journey reservation lookup");
    reservationRow = { ...reservationRow, ...looked };
  }
  if (!reservationRow?.id) throw new Error("JOURNEY_PRODUCTION_RESERVATION_ID_MISSING");
  const reserved = Number(reservationRow?.reserved_qty ?? 0);
  if (reserved > 0) {
    throw new Error(`JOURNEY_PRODUCTION_BLOCKED_STOCK_COVERED: ${reserved} of ${quantity} are covered by finished-goods stock; Core #483 only recognises production-accepted quantity, so this line cannot be completed from that evidence`);
  }
  recordPhase("RGS reservation raises the full shortage to production", "ADMIN", "reserve_rgs_stock", { reservationId: reservationRow?.id, requested: quantity, reserved });

  const runJob = async (label, produced, accepted, rejected, hold) => {
    const demand = await adminClient.rpc("create_production_shortage_demand", { p_reservation_id: reservationRow.id, p_department: department.source, p_priority: "normal", p_correlation_id: `journey-${suffix}-${label}-demand` });
    assertNoError(demand.error, `Journey ${label} production demand`);
    const job = firstRow(demand.data);
    const jobId = String(job?.id ?? "");
    if (!jobId) throw new Error(`JOURNEY_PRODUCTION_JOB_MISSING: ${label}`);
    const batch = `JRN-${suffix}-${label}`;
    assertNoError((await prod.rpc("accept_production_job", { p_job_id: jobId, p_batch_number: batch, p_correlation_id: `journey-${suffix}-${label}-accept` })).error, `Journey ${label} accept job`);
    assertNoError((await prod.rpc("start_production_job", { p_job_id: jobId, p_correlation_id: `journey-${suffix}-${label}-start` })).error, `Journey ${label} start job`);
    let stage = null;
    for (let i = 0; i < 6; i += 1) {
      const advanced = await prod.rpc("advance_production_job_stage", { p_job_id: jobId, p_correlation_id: `journey-${suffix}-${label}-advance-${i}` });
      assertNoError(advanced.error, `Journey ${label} advance stage`);
      const next = firstRow(advanced.data)?.stage;
      if (next === stage || next === "ready") { stage = next; break; }
      stage = next;
    }
    if (stage !== "ready") throw new Error(`JOURNEY_PRODUCTION_STAGE_NOT_READY: ${label} ended at ${stage}`);
    assertNoError((await prod.rpc("record_production_output", { p_job_id: jobId, p_produced_qty: produced, p_wasted_qty: 0, p_batch_number: batch, p_correlation_id: `journey-${suffix}-${label}-output` })).error, `Journey ${label} record output`);
    assertNoError((await prod.rpc("declare_production_ready", { p_job_id: jobId, p_correlation_id: `journey-${suffix}-${label}-ready` })).error, `Journey ${label} declare ready`);
    const transfer = await prod.rpc("dispatch_production_to_rgs", { p_job_id: jobId, p_dispatched_qty: produced, p_correlation_id: `journey-${suffix}-${label}-transfer` });
    assertNoError(transfer.error, `Journey ${label} dispatch to RGS`);
    const transferId = String(firstRow(transfer.data)?.id ?? "");
    assertNoError((await store.rpc("record_rgs_receipt", { p_transfer_id: transferId, p_received_qty: produced, p_correlation_id: `journey-${suffix}-${label}-receipt` })).error, `Journey ${label} RGS receipt`);
    const { data: balance } = await store.from("inventory_stock_balances").select("version").eq("product_id", product.id).eq("sku", product.sku).eq("location_code", "FINISHED_GOODS").maybeSingle();
    const accept = await store.rpc("accept_rgs_production_receipt", { p_transfer_id: transferId, p_accepted_qty: accepted, p_rejected_qty: rejected, p_hold_qty: hold, p_expected_balance_version: Number(balance?.version ?? 0), p_correlation_id: `journey-${suffix}-${label}-accept-receipt` });
    assertNoError(accept.error, `Journey ${label} RGS acceptance`);
    recordPhase(`Production job ${label}: produced ${produced}, RGS accepted ${accepted}, rejected ${rejected}, held ${hold}`, `${department.role}+STORE_READY_GOODS`, "accept_production_job ... accept_rgs_production_receipt", { jobId, transferId });
    return { jobId, transferId };
  };

  // 2. First batch: 4-of-quantity produced, one rejected and one held at RGS, so accepted = quantity - 3 (partial).
  const firstProduced = quantity;
  const firstAccepted = Math.max(1, quantity - 3);
  const firstRejected = 1;
  const firstHold = firstProduced - firstAccepted - firstRejected;
  await runJob("batch1", firstProduced, firstAccepted, firstRejected, firstHold);

  const complete = async (key, client = dispatchClient) => {
    const result = await client.rpc("complete_order_item_from_production_v1", { p_order_item_id: orderItem.id, p_correlation_id: `journey-${suffix}-${key}` });
    assertNoError(result.error, `Journey completion ${key}`);
    return result.data;
  };

  const partial = await complete("complete-1");
  if (partial?.outcome !== "PARTIAL" || Number(partial?.packed_qty) !== firstAccepted) {
    throw new Error(`JOURNEY_COMPLETION_PARTIAL_UNEXPECTED: ${JSON.stringify(partial)} (expected PARTIAL ${firstAccepted}; rejected and held quantity must not count)`);
  }
  recordPhase(`Governed completion is PARTIAL (${firstAccepted}/${quantity}); rejected and held quantity excluded`, "DISPATCH_MANAGER", "complete_order_item_from_production_v1", { packedQty: partial.packed_qty });
  const replay = await complete("complete-1");
  if (replay?.already_recorded !== true) throw new Error(`JOURNEY_COMPLETION_REPLAY_NOT_IDEMPOTENT: ${JSON.stringify(replay)}`);
  const noNew = await complete("complete-1b");
  if (noNew?.already_current !== true || Number(noNew?.packed_qty) !== firstAccepted) throw new Error(`JOURNEY_COMPLETION_NO_NEW_EVIDENCE_NOT_NOOP: ${JSON.stringify(noNew)}`);
  recordPhase("Completion retry and re-run without new evidence are idempotent (no inflation)", "DISPATCH_MANAGER", "complete_order_item_from_production_v1", {});

  // 3. Second batch supplies the remainder and is fully accepted.
  const remainder = quantity - firstAccepted;
  await runJob("batch2", remainder, remainder, 0, 0);
  const done = await complete("complete-2");
  if (done?.outcome !== "COMPLETE" || Number(done?.packed_qty) !== quantity) {
    throw new Error(`JOURNEY_COMPLETION_UNEXPECTED: ${JSON.stringify(done)} (expected COMPLETE ${quantity})`);
  }
  const after = await complete("complete-3");
  if (Number(after?.packed_qty) !== quantity) throw new Error(`JOURNEY_COMPLETION_INFLATED: ${JSON.stringify(after)}`);
  recordPhase(`Governed completion is COMPLETE (${quantity}/${quantity}) from accepted production only`, "DISPATCH_MANAGER", "complete_order_item_from_production_v1", { packedQty: done.packed_qty });

  await Promise.allSettled([prod.auth.signOut(), store.auth.signOut()]);
}
