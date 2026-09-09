#!/usr/bin/env node
/**
 * Point100-only repair for the legacy Point38 fixture.
 *
 * The shared Factory fixture intentionally leaves Point38 in a historical,
 * status-shaped cleared_for_dispatch state. Final Point100 certification must
 * replace that shortcut with canonical software authority facts before any
 * dress-rehearsal assertion runs:
 *   operations clearance -> source/Dispatch custody -> carton truth -> DPL ->
 *   Finance DPL receipt -> final invoice -> final settlement -> e-way decision
 *   -> Finance Dispatch Clearance.
 *
 * This script is disposable-local only. It uses distinct authenticated roles
 * and real Core RPCs; it never inserts/updates final invoice, clearance, DPL,
 * carton, handoff or payment authority tables directly.
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { computeTotpCode } from "../factory-certification/totp.mjs";

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const CREDENTIAL_FILE = "/tmp/oasis-factory-certification.env";
const RUN_TOKEN = "point100-point38-canonical-v1";
const BATCH_LOT = "POINT100-P38-LOT-001";

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`POINT100_POINT38_ENV_REQUIRED: ${name}`);
  return value;
}

function assertLoopbackHttp(rawUrl) {
  const parsed = new URL(rawUrl);
  if (parsed.protocol !== "http:" || !LOOPBACK_HOSTS.has(parsed.hostname)) {
    throw new Error(`POINT100_POINT38_LOCAL_ONLY: refusing Supabase target ${parsed.origin}`);
  }
  if (parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) {
    throw new Error("POINT100_POINT38_LOCAL_ONLY: Supabase URL must be a canonical loopback origin");
  }
  return parsed.origin;
}

function parseCredentialFile() {
  const values = new Map();
  const raw = readFileSync(CREDENTIAL_FILE, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const match = /^export ([A-Z0-9_]+)='([^']*)'$/.exec(line.trim());
    if (match) values.set(match[1], match[2]);
  }
  return values;
}

const credentialValues = parseCredentialFile();

function credentialValue(name) {
  const value = credentialValues.get(name)?.trim();
  if (!value) throw new Error(`POINT100_POINT38_CREDENTIAL_REQUIRED: ${name}`);
  return value;
}

function roleCredentials(role) {
  const canonical = role.trim().toUpperCase();
  return {
    email: credentialValue(`FACTORY_CERT_${canonical}_EMAIL`),
    password: credentialValue(`FACTORY_CERT_${canonical}_PASSWORD`),
    totpSecret: credentialValues.get(`FACTORY_CERT_${canonical}_TOTP_SECRET`)?.trim() || null,
  };
}

function assertNoError(error, operation) {
  if (!error) return;
  throw new Error(`${operation}: ${error.message ?? String(error)}`);
}

const backendUrl = assertLoopbackHttp(requireEnv("FACTORY_CERT_SUPABASE_URL"));
const anonKey = requireEnv("FACTORY_CERT_SUPABASE_ANON_KEY");
const localDbUrl = requireEnv("FACTORY_CERT_LOCAL_DB_URL");
const point38OrderId = credentialValue("FACTORY_CERT_POINT38_ORDER_ID");
const point38OrderItemId = credentialValue("FACTORY_CERT_POINT38_ORDER_ITEM_ID");

function newClient() {
  return createClient(backendUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

async function authenticatedRole(role, { aal2 = false } = {}) {
  const creds = roleCredentials(role);
  const client = newClient();
  const { error: signInError } = await client.auth.signInWithPassword({
    email: creds.email,
    password: creds.password,
  });
  assertNoError(signInError, `Point38 ${role} sign-in`);

  if (aal2) {
    if (!creds.totpSecret) {
      throw new Error(`POINT100_POINT38_AAL2_SECRET_REQUIRED: FACTORY_CERT_${role}_TOTP_SECRET`);
    }
    const { data: factors, error: factorsError } = await client.auth.mfa.listFactors();
    assertNoError(factorsError, `Point38 ${role} MFA list`);
    const factor = factors?.totp?.find((candidate) => candidate.status === "verified");
    if (!factor) throw new Error(`POINT100_POINT38_AAL2_FACTOR_REQUIRED: ${role}`);
    const { data: challenge, error: challengeError } = await client.auth.mfa.challenge({ factorId: factor.id });
    assertNoError(challengeError, `Point38 ${role} MFA challenge`);
    const { error: verifyError } = await client.auth.mfa.verify({
      factorId: factor.id,
      challengeId: challenge.id,
      code: computeTotpCode(creds.totpSecret),
    });
    assertNoError(verifyError, `Point38 ${role} MFA verify`);
  }

  const { data: userData, error: userError } = await client.auth.getUser();
  assertNoError(userError, `Point38 ${role} auth user`);
  const actorId = userData.user?.id;
  if (!actorId) throw new Error(`POINT100_POINT38_ACTOR_REQUIRED: ${role}`);
  return { client, actorId };
}

function postgresScalar(sql, label) {
  const parsed = new URL(localDbUrl);
  if (!["postgres:", "postgresql:"].includes(parsed.protocol) || !LOOPBACK_HOSTS.has(parsed.hostname)) {
    throw new Error(`POINT100_POINT38_LOCAL_ONLY: refusing Postgres target for ${label}`);
  }
  try {
    return execFileSync("psql", ["-At", "-v", "ON_ERROR_STOP=1", "-q", "-c", sql], {
      stdio: ["ignore", "pipe", "pipe"],
      encoding: "utf8",
      env: {
        ...process.env,
        PGHOST: parsed.hostname,
        PGPORT: parsed.port || "5432",
        PGUSER: decodeURIComponent(parsed.username),
        PGPASSWORD: decodeURIComponent(parsed.password),
        PGDATABASE: decodeURIComponent(parsed.pathname.replace(/^\//, "")) || "postgres",
      },
    }).trim();
  } catch (error) {
    const stderr = error?.stderr ? error.stderr.toString("utf8") : String(error?.message ?? error);
    throw new Error(`${label}: ${stderr.trim()}`);
  }
}

function postgresJsonbSha256(value) {
  const raw = JSON.stringify(value);
  const tag = "$point100json$";
  if (raw.includes(tag)) throw new Error("POINT100_POINT38_JSON_TAG_COLLISION");
  const digest = postgresScalar(
    `select encode(extensions.digest(${tag}${raw}${tag}::jsonb::text,'sha256'),'hex');`,
    "Point38 DPL fingerprint computation",
  );
  if (!/^[0-9a-f]{64}$/.test(digest)) {
    throw new Error(`POINT100_POINT38_DPL_FINGERPRINT_INVALID: ${digest}`);
  }
  return digest;
}

function firstRow(data) {
  return Array.isArray(data) ? data[0] : data;
}

async function ensureOperationsClearance(finance, financeActorId, piId, commercialVersionId) {
  let factsResult = await finance.rpc("get_finance_operations_clearance_facts_v1", {
    p_order_id: point38OrderId,
    p_pi_id: piId,
    p_commercial_version_id: commercialVersionId,
  });
  assertNoError(factsResult.error, "Point38 finance operations facts");
  let facts = firstRow(factsResult.data);
  if (!facts || typeof facts !== "object") throw new Error("POINT100_POINT38_OPERATIONS_FACTS_MISSING");

  if (facts.eligible_for_operations_clearance !== true) {
    const requiredAdvance = Number(facts.required_advance ?? 0);
    if (requiredAdvance > 0.01) {
      const proofCorrelation = `${RUN_TOKEN}:advance-proof`;
      const proof = await finance.rpc("record_order_payment_proof_v1", {
        p_order_id: point38OrderId,
        p_pi_id: piId,
        p_commercial_version_id: commercialVersionId,
        p_payment_type: "advance",
        p_submitted_amount: requiredAdvance,
        p_currency: "INR",
        p_payment_mode: "bank_transfer",
        p_external_reference: "POINT100-P38-ADVANCE",
        p_payer_reference: null,
        p_proof_evidence_reference: "point100:p38:advance-proof",
        p_source_channel: "CENTRAL",
        p_source_reference: `point100:${point38OrderId}`,
        p_correlation_id: proofCorrelation,
        p_idempotency_key: proofCorrelation,
        p_actor_id: financeActorId,
      });
      assertNoError(proof.error, "Point38 advance proof");
      const paymentId = String(firstRow(proof.data)?.payment_id ?? "");
      if (!paymentId) throw new Error("POINT100_POINT38_ADVANCE_PAYMENT_ID_MISSING");
      const verifyCorrelation = `${RUN_TOKEN}:advance-verify`;
      const verified = await finance.rpc("verify_order_payment_v1", {
        p_payment_id: paymentId,
        p_verified_amount: requiredAdvance,
        p_verified_reference: "POINT100-P38-ADVANCE-VERIFIED",
        p_verification_evidence_reference: "point100:p38:advance-verified",
        p_reason: "Point100 governed advance verification",
        p_correlation_id: verifyCorrelation,
        p_idempotency_key: verifyCorrelation,
        p_actor_id: financeActorId,
      });
      assertNoError(verified.error, "Point38 advance verification");
    }

    factsResult = await finance.rpc("get_finance_operations_clearance_facts_v1", {
      p_order_id: point38OrderId,
      p_pi_id: piId,
      p_commercial_version_id: commercialVersionId,
    });
    assertNoError(factsResult.error, "Point38 refreshed finance operations facts");
    facts = firstRow(factsResult.data);
    if (!facts || typeof facts !== "object") throw new Error("POINT100_POINT38_REFRESHED_OPERATIONS_FACTS_MISSING");
  }

  if (facts.latest_clearance_decision !== "GRANTED") {
    const correlation = `${RUN_TOKEN}:operations-clearance`;
    const decision = await finance.rpc("decide_finance_operations_clearance_v1", {
      p_order_id: point38OrderId,
      p_pi_id: piId,
      p_commercial_version_id: commercialVersionId,
      p_decision: "GRANTED",
      p_reason: "Point100 governed operations clearance",
      p_evidence_reference: "point100:p38:operations-clearance",
      p_source_channel: "CENTRAL",
      p_source_reference: `point100:${point38OrderId}`,
      p_correlation_id: correlation,
      p_idempotency_key: correlation,
      p_actor_id: financeActorId,
    });
    assertNoError(decision.error, "Point38 operations clearance decision");
  }

  const finalFacts = await finance.rpc("get_finance_operations_clearance_facts_v1", {
    p_order_id: point38OrderId,
    p_pi_id: piId,
    p_commercial_version_id: commercialVersionId,
  });
  assertNoError(finalFacts.error, "Point38 final finance operations facts");
  const finalRow = firstRow(finalFacts.data);
  if (!finalRow || finalRow.eligible_for_operations_clearance !== true || finalRow.latest_clearance_decision !== "GRANTED") {
    throw new Error(`POINT100_POINT38_OPERATIONS_CLEARANCE_NOT_ACTIVE: ${JSON.stringify(finalRow)}`);
  }
}

async function ensureFinalSettlement(finance, financeActorId, piId, commercialVersionId, finalInvoiceId) {
  let settlementResult = await finance.rpc("get_final_settlement_facts_v1", { p_final_invoice_id: finalInvoiceId });
  assertNoError(settlementResult.error, "Point38 final settlement facts");
  let settlement = settlementResult.data;
  if (!settlement || typeof settlement !== "object") throw new Error("POINT100_POINT38_SETTLEMENT_FACTS_MISSING");

  const netDue = Number(settlement.net_due ?? 0);
  if (netDue > 0.01) {
    const correlation = `${RUN_TOKEN}:balance-proof`;
    const proof = await finance.rpc("record_order_payment_proof_v1", {
      p_order_id: point38OrderId,
      p_pi_id: piId,
      p_commercial_version_id: commercialVersionId,
      p_payment_type: "balance",
      p_submitted_amount: netDue,
      p_currency: "INR",
      p_payment_mode: "bank_transfer",
      p_external_reference: "POINT100-P38-BALANCE",
      p_payer_reference: null,
      p_proof_evidence_reference: "point100:p38:balance-proof",
      p_source_channel: "CENTRAL",
      p_source_reference: `point100:${point38OrderId}`,
      p_correlation_id: correlation,
      p_idempotency_key: correlation,
      p_actor_id: financeActorId,
    });
    assertNoError(proof.error, "Point38 balance proof");
    const paymentId = String(firstRow(proof.data)?.payment_id ?? "");
    if (!paymentId) throw new Error("POINT100_POINT38_BALANCE_PAYMENT_ID_MISSING");
    const verifyCorrelation = `${RUN_TOKEN}:balance-verify`;
    const verified = await finance.rpc("verify_order_payment_v1", {
      p_payment_id: paymentId,
      p_verified_amount: netDue,
      p_verified_reference: "POINT100-P38-BALANCE-VERIFIED",
      p_verification_evidence_reference: "point100:p38:balance-verified",
      p_reason: "Point100 governed final balance verification",
      p_correlation_id: verifyCorrelation,
      p_idempotency_key: verifyCorrelation,
      p_actor_id: financeActorId,
    });
    assertNoError(verified.error, "Point38 balance verification");
  }

  settlementResult = await finance.rpc("get_final_settlement_facts_v1", { p_final_invoice_id: finalInvoiceId });
  assertNoError(settlementResult.error, "Point38 refreshed final settlement facts");
  settlement = settlementResult.data;
  if (!settlement || settlement.settled_for_dispatch !== true) {
    throw new Error(`POINT100_POINT38_FINAL_SETTLEMENT_NOT_CLEARED: ${JSON.stringify(settlement)}`);
  }
}

const financeRole = await authenticatedRole("FINANCE_HEAD", { aal2: true });
const adminRole = await authenticatedRole("ADMIN");
const dispatchRole = await authenticatedRole("DISPATCH_MANAGER");

try {
  const { data: bindings, error: bindingError } = await financeRole.client
    .from("sales_order_proforma_invoice_authority_v1")
    .select("id,commercial_version_id,status")
    .eq("order_id", point38OrderId)
    .in("status", ["READY_FOR_ISSUE", "ISSUED"])
    .limit(1);
  assertNoError(bindingError, "Point38 PI binding read");
  if (!bindings?.length) throw new Error("POINT100_POINT38_PI_BINDING_MISSING");
  const piId = String(bindings[0].id);
  const commercialVersionId = String(bindings[0].commercial_version_id);

  await ensureOperationsClearance(financeRole.client, financeRole.actorId, piId, commercialVersionId);

  const { data: orderItem, error: orderItemError } = await dispatchRole.client
    .from("order_items")
    .select("id,product_id,quantity,carton_type")
    .eq("id", point38OrderItemId)
    .eq("order_id", point38OrderId)
    .maybeSingle();
  assertNoError(orderItemError, "Point38 order item read");
  if (!orderItem?.id || !orderItem.product_id || Number(orderItem.quantity ?? 0) <= 0) {
    throw new Error(`POINT100_POINT38_ORDER_ITEM_INVALID: ${JSON.stringify(orderItem)}`);
  }
  const quantity = Number(orderItem.quantity);
  const { data: product, error: productError } = await dispatchRole.client
    .from("products")
    .select("id,sku,barcode_sku")
    .eq("id", orderItem.product_id)
    .maybeSingle();
  assertNoError(productError, "Point38 product read");
  const barcode = String(product?.barcode_sku || product?.sku || "").trim();
  if (!barcode) throw new Error("POINT100_POINT38_BARCODE_REQUIRED");

  const consignmentResult = await dispatchRole.client.rpc("create_b2b_dispatch_consignment", {
    p_order_id: point38OrderId,
    p_dispatch_mode: "road_transporter",
    p_lines: [{ order_item_id: point38OrderItemId, selected_qty: quantity, uom: orderItem.carton_type || "unit" }],
    p_correlation_id: `${RUN_TOKEN}:consignment`,
  });
  assertNoError(consignmentResult.error, "Point38 consignment creation");
  const consignment = firstRow(consignmentResult.data);
  const consignmentId = String(consignment?.id ?? "");
  if (!consignmentId) throw new Error("POINT100_POINT38_CONSIGNMENT_ID_MISSING");

  const { data: consignmentLine, error: lineError } = await dispatchRole.client
    .from("b2b_dispatch_consignment_lines")
    .select("id,order_item_id,product_id,uom,selected_qty,accepted_ready_qty")
    .eq("consignment_id", consignmentId)
    .eq("order_item_id", point38OrderItemId)
    .maybeSingle();
  assertNoError(lineError, "Point38 consignment line read");
  if (!consignmentLine?.id) throw new Error("POINT100_POINT38_CONSIGNMENT_LINE_MISSING");

  const handoffResult = await adminRole.client.rpc("declare_b2b_dispatch_source_handoff", {
    p_consignment_id: consignmentId,
    p_source_department: "PRODUCTION",
    p_source_location: "POINT100_SYNTHETIC_READY",
    p_lines: [{ order_item_id: point38OrderItemId, declared_qty: quantity, batch_lot: BATCH_LOT }],
    p_correlation_id: `${RUN_TOKEN}:handoff-declare`,
  });
  assertNoError(handoffResult.error, "Point38 source handoff declaration");
  const handoffId = String(firstRow(handoffResult.data)?.id ?? "");
  if (!handoffId) throw new Error("POINT100_POINT38_HANDOFF_ID_MISSING");

  const receiptResult = await dispatchRole.client.rpc("record_b2b_dispatch_handoff_receipt", {
    p_handoff_id: handoffId,
    p_lines: [{ order_item_id: point38OrderItemId, physically_received_qty: quantity }],
    p_correlation_id: `${RUN_TOKEN}:handoff-receipt`,
  });
  assertNoError(receiptResult.error, "Point38 handoff receipt");

  const acceptResult = await dispatchRole.client.rpc("accept_b2b_dispatch_handoff", {
    p_handoff_id: handoffId,
    p_lines: [{ order_item_id: point38OrderItemId, accepted_qty: quantity, held_qty: 0, rejected_qty: 0 }],
    p_correlation_id: `${RUN_TOKEN}:handoff-accept`,
  });
  assertNoError(acceptResult.error, "Point38 handoff acceptance");

  const cartonResult = await dispatchRole.client.rpc("open_b2b_dispatch_carton", {
    p_consignment_id: consignmentId,
    p_carton_code: "POINT100-P38-CARTON-001",
  });
  assertNoError(cartonResult.error, "Point38 carton open");
  const cartonId = String(firstRow(cartonResult.data)?.id ?? "");
  if (!cartonId) throw new Error("POINT100_POINT38_CARTON_ID_MISSING");

  const scanResult = await dispatchRole.client.rpc("record_b2b_dispatch_carton_item_scan", {
    p_carton_id: cartonId,
    p_consignment_line_id: consignmentLine.id,
    p_barcode_value: barcode,
    p_batch_lot: BATCH_LOT,
    p_quantity: quantity,
    p_correlation_id: `${RUN_TOKEN}:carton-scan`,
    p_expiry_date: null,
    p_device_id: "point100-synthetic-scanner",
  });
  assertNoError(scanResult.error, "Point38 carton scan");
  const scan = firstRow(scanResult.data);
  if (scan?.scan_result !== "verified") {
    throw new Error(`POINT100_POINT38_CARTON_SCAN_NOT_VERIFIED: ${JSON.stringify(scan)}`);
  }

  const evidenceResult = await dispatchRole.client.rpc("record_b2b_dispatch_carton_evidence", {
    p_carton_id: cartonId,
    p_net_weight: quantity,
    p_gross_weight: quantity + 0.5,
    p_open_photo_ref: "point100://synthetic-carton-open-photo/p38",
    p_correlation_id: `${RUN_TOKEN}:carton-evidence`,
  });
  assertNoError(evidenceResult.error, "Point38 carton evidence");
  const expectedVersion = Number(firstRow(evidenceResult.data)?.current_version ?? 0);
  if (!Number.isInteger(expectedVersion) || expectedVersion <= 0) {
    throw new Error(`POINT100_POINT38_CARTON_VERSION_INVALID: ${expectedVersion}`);
  }

  const lockResult = await dispatchRole.client.rpc("lock_b2b_dispatch_carton", {
    p_carton_id: cartonId,
    p_expected_version: expectedVersion,
    p_correlation_id: `${RUN_TOKEN}:carton-lock`,
  });
  assertNoError(lockResult.error, "Point38 carton lock");

  const dplCreateResult = await dispatchRole.client.rpc("create_b2b_dispatch_packing_list", {
    p_consignment_id: consignmentId,
    p_correlation_id: `${RUN_TOKEN}:dpl-create`,
  });
  assertNoError(dplCreateResult.error, "Point38 DPL creation");
  const dpl = firstRow(dplCreateResult.data);
  const dplId = String(dpl?.id ?? "");
  const dplVersion = Number(dpl?.version_number ?? 0);
  if (!dplId || !Number.isInteger(dplVersion) || dplVersion <= 0) {
    throw new Error(`POINT100_POINT38_DPL_INVALID: ${JSON.stringify(dpl)}`);
  }

  const dplSubmitResult = await dispatchRole.client.rpc("submit_b2b_dispatch_packing_list_to_finance", {
    p_consignment_id: consignmentId,
    p_version_id: dplId,
    p_correlation_id: `${RUN_TOKEN}:dpl-submit`,
  });
  assertNoError(dplSubmitResult.error, "Point38 DPL submission");

  const financeDplSnapshot = {
    order_id: point38OrderId,
    commercial_version_id: commercialVersionId,
    external_dpl_id: dplId,
    dpl_version: dplVersion,
    carton_ids: [cartonId],
    lines: [{
      order_item_id: point38OrderItemId,
      product_id: String(orderItem.product_id),
      actual_dispatch_qty: quantity,
      uom: String(consignmentLine.uom || orderItem.carton_type || "unit"),
    }],
  };
  const dplFingerprint = postgresJsonbSha256(financeDplSnapshot);
  const dplReceiptResult = await adminRole.client.rpc("receive_finance_dpl_v1", {
    p_order_id: point38OrderId,
    p_commercial_version_id: commercialVersionId,
    p_external_dpl_id: dplId,
    p_dpl_version: dplVersion,
    p_dpl_snapshot: financeDplSnapshot,
    p_dpl_fingerprint: dplFingerprint,
    p_finalized_at: new Date(Date.now() - 1000).toISOString(),
    p_evidence_reference: `point100:dpl:${dplId}`,
    p_source_channel: "DISPATCH",
    p_source_reference: `consignment:${consignmentId}`,
    p_correlation_id: `${RUN_TOKEN}:finance-dpl-receipt`,
    p_idempotency_key: `${RUN_TOKEN}:finance-dpl-receipt`,
    p_actor_id: adminRole.actorId,
  });
  assertNoError(dplReceiptResult.error, "Point38 Finance DPL receipt");
  const financeDplReceiptId = String(firstRow(dplReceiptResult.data)?.receipt_id ?? "");
  if (!financeDplReceiptId) throw new Error("POINT100_POINT38_FINANCE_DPL_RECEIPT_ID_MISSING");

  const invoiceResult = await financeRole.client.rpc("issue_final_invoice_v1", {
    p_order_id: point38OrderId,
    p_pi_id: piId,
    p_commercial_version_id: commercialVersionId,
    p_finance_dpl_receipt_id: financeDplReceiptId,
    p_invoice_number: "POINT100-P38-FINAL-001",
    p_invoice_date: new Date().toISOString().slice(0, 10),
    p_document_reference: "point100://final-invoice/p38",
    p_reason: "Point100 canonical final invoice certification",
    p_correlation_id: `${RUN_TOKEN}:final-invoice`,
    p_idempotency_key: `${RUN_TOKEN}:final-invoice`,
    p_actor_id: financeRole.actorId,
  });
  assertNoError(invoiceResult.error, "Point38 final invoice issue");
  const finalInvoiceId = String(firstRow(invoiceResult.data)?.final_invoice_id ?? "");
  if (!finalInvoiceId) throw new Error("POINT100_POINT38_FINAL_INVOICE_ID_MISSING");

  await ensureFinalSettlement(financeRole.client, financeRole.actorId, piId, commercialVersionId, finalInvoiceId);

  const ewayResult = await financeRole.client.rpc("record_eway_bill_evidence_v1", {
    p_final_invoice_id: finalInvoiceId,
    p_status: "NOT_REQUIRED",
    p_eway_bill_number: null,
    p_document_reference: null,
    p_policy_reason: "Point100 synthetic certification: e-way bill not required",
    p_valid_from: null,
    p_valid_until: null,
    p_correlation_id: `${RUN_TOKEN}:eway`,
    p_idempotency_key: `${RUN_TOKEN}:eway`,
    p_actor_id: financeRole.actorId,
  });
  assertNoError(ewayResult.error, "Point38 e-way decision");

  const clearanceResult = await financeRole.client.rpc("decide_finance_dispatch_clearance_v1", {
    p_final_invoice_id: finalInvoiceId,
    p_decision: "GRANTED",
    p_reason: "Point100 canonical dispatch clearance certification",
    p_evidence_reference: "point100:p38:dispatch-clearance",
    p_correlation_id: `${RUN_TOKEN}:dispatch-clearance`,
    p_idempotency_key: `${RUN_TOKEN}:dispatch-clearance`,
    p_actor_id: financeRole.actorId,
  });
  assertNoError(clearanceResult.error, "Point38 Finance Dispatch Clearance");

  const exitFactsResult = await dispatchRole.client.rpc("get_finance_exit_facts_v1", { p_order_id: point38OrderId });
  assertNoError(exitFactsResult.error, "Point38 finance exit verification");
  const exitFacts = firstRow(exitFactsResult.data);
  if (
    !exitFacts ||
    String(exitFacts.final_invoice_id ?? "") !== finalInvoiceId ||
    exitFacts.dispatch_cleared !== true ||
    !exitFacts.dispatch_clearance_event_id
  ) {
    throw new Error(`POINT100_POINT38_FINANCE_EXIT_NOT_READY: ${JSON.stringify(exitFacts)}`);
  }

  console.log("Point100 Point38 canonical exit fixture prepared through governed Core authorities.");
} finally {
  await Promise.allSettled([
    financeRole.client.auth.signOut(),
    adminRole.client.auth.signOut(),
    dispatchRole.client.auth.signOut(),
  ]);
}
