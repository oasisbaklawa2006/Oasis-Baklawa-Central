#!/usr/bin/env node
/**
 * Point100 disposable-only final dispatch tail.
 *
 * Completes the already-governed Point38 fixture through independent Gate
 * validation -> immutable dispatch proof -> canonical dispatch finalization.
 * Synthetic scan/transport values prove software contracts only; they are not
 * physical UAT evidence. All mutations go through canonical Core authority.
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const CREDENTIAL_FILE = "/tmp/oasis-factory-certification.env";
const RUN_TOKEN = "point100-point38-canonical-v1";

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`POINT100_POINT38_TAIL_ENV_REQUIRED: ${name}`);
  return value;
}

function assertLoopbackHttp(rawUrl) {
  const parsed = new URL(rawUrl);
  if (parsed.protocol !== "http:" || !LOOPBACK_HOSTS.has(parsed.hostname)) {
    throw new Error(`POINT100_POINT38_TAIL_LOCAL_ONLY: refusing ${parsed.origin}`);
  }
  if (parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) {
    throw new Error("POINT100_POINT38_TAIL_LOCAL_ONLY: Supabase URL must be a canonical loopback origin");
  }
  return parsed.origin;
}

function parseCredentialFile() {
  const values = new Map();
  for (const line of readFileSync(CREDENTIAL_FILE, "utf8").split(/\r?\n/)) {
    const match = /^export ([A-Z0-9_]+)='([^']*)'$/.exec(line.trim());
    if (match) values.set(match[1], match[2]);
  }
  return values;
}

const values = parseCredentialFile();
function credentialValue(name) {
  const value = values.get(name)?.trim();
  if (!value) throw new Error(`POINT100_POINT38_TAIL_CREDENTIAL_REQUIRED: ${name}`);
  return value;
}

function roleCredentials(role) {
  const canonical = role.trim().toUpperCase();
  return {
    email: credentialValue(`FACTORY_CERT_${canonical}_EMAIL`),
    password: credentialValue(`FACTORY_CERT_${canonical}_PASSWORD`),
  };
}

function assertNoError(error, operation) {
  if (error) throw new Error(`${operation}: ${error.message ?? String(error)}`);
}

function firstRow(data) {
  return Array.isArray(data) ? data[0] : data;
}

const backendUrl = assertLoopbackHttp(requireEnv("FACTORY_CERT_SUPABASE_URL"));
const anonKey = requireEnv("FACTORY_CERT_SUPABASE_ANON_KEY");
const point38OrderId = credentialValue("FACTORY_CERT_POINT38_ORDER_ID");

function newClient() {
  return createClient(backendUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

async function authenticatedRole(role) {
  const creds = roleCredentials(role);
  const client = newClient();
  const { error: signInError } = await client.auth.signInWithPassword({ email: creds.email, password: creds.password });
  assertNoError(signInError, `Point38 tail ${role} sign-in`);
  const { data: userData, error: userError } = await client.auth.getUser();
  assertNoError(userError, `Point38 tail ${role} auth user`);
  const actorId = userData.user?.id;
  if (!actorId) throw new Error(`POINT100_POINT38_TAIL_ACTOR_REQUIRED: ${role}`);
  return { client, actorId };
}

const dispatchRole = await authenticatedRole("DISPATCH_MANAGER");
const gateRole = await authenticatedRole("GATE_SECURITY");

try {
  const { data: consignments, error: consignmentError } = await dispatchRole.client
    .from("b2b_dispatch_consignments")
    .select("id")
    .eq("order_id", point38OrderId)
    .order("created_at", { ascending: false })
    .limit(1);
  assertNoError(consignmentError, "Point38 tail consignment lookup");
  const consignmentId = String(consignments?.[0]?.id ?? "");
  if (!consignmentId) throw new Error("POINT100_POINT38_TAIL_CONSIGNMENT_MISSING");

  const { data: cartons, error: cartonError } = await dispatchRole.client
    .from("b2b_dispatch_cartons")
    .select("id,carton_code")
    .eq("consignment_id", consignmentId)
    .order("created_at", { ascending: false })
    .limit(1);
  assertNoError(cartonError, "Point38 tail carton lookup");
  const cartonId = String(cartons?.[0]?.id ?? "");
  const cartonCode = String(cartons?.[0]?.carton_code ?? "").trim();
  if (!cartonId || !cartonCode) throw new Error("POINT100_POINT38_TAIL_CARTON_MISSING");

  const gateScanCorrelation = `${RUN_TOKEN}:synthetic-gate-scan`;
  const { data: priorScan, error: priorScanError } = await gateRole.client
    .from("operational_scan_records")
    .select("id")
    .eq("correlation_id", gateScanCorrelation)
    .maybeSingle();
  assertNoError(priorScanError, "Point38 tail prior gate scan lookup");

  let gateScanId = String(priorScan?.id ?? "");
  if (!gateScanId) {
    const { data: gateScan, error: gateScanError } = await gateRole.client
      .from("operational_scan_records")
      .insert({
        scan_type: "dispatch_gate",
        verification_type: "gate_check",
        entity_type: "dispatch_carton",
        entity_id: cartonId,
        order_id: point38OrderId,
        barcode_value: cartonCode,
        expected_barcode: cartonCode,
        verification_status: "scanned",
        scan_source: "point100_disposable_synthetic_gate",
        actor_id: gateRole.actorId,
        actor_role: "GATE_SECURITY",
        correlation_id: gateScanCorrelation,
        metadata: { certification_mode: "disposable_synthetic", physical_uat: false },
      })
      .select("id")
      .single();
    assertNoError(gateScanError, "Point38 tail synthetic gate scan");
    gateScanId = String(gateScan?.id ?? "");
  }
  if (!gateScanId) throw new Error("POINT100_POINT38_TAIL_GATE_SCAN_ID_MISSING");

  const { data: gateDecisionData, error: gateDecisionError } = await gateRole.client.rpc("release_b2b_dispatch_carton_at_gate_v1", {
    p_carton_id: cartonId,
    p_scan_evidence_id: gateScanId,
  });
  assertNoError(gateDecisionError, "Point38 tail gate release");
  const gateDecision = firstRow(gateDecisionData) ?? gateDecisionData;
  if (gateDecision?.ok !== true) {
    throw new Error(`POINT100_POINT38_TAIL_GATE_BLOCKED: ${JSON.stringify(gateDecision?.blockers ?? gateDecision)}`);
  }

  const { error: verifyScanError } = await gateRole.client
    .from("operational_scan_records")
    .update({ verification_status: "verified" })
    .eq("id", gateScanId);
  assertNoError(verifyScanError, "Point38 tail gate evidence verification");

  const dispatchedAt = new Date().toISOString();
  const trackingReference = "P100-TRK-POINT38-CANONICAL";
  const proofIdentity = `${RUN_TOKEN}:dispatch-proof`;
  const { data: proofData, error: proofError } = await gateRole.client.rpc("record_dispatch_proof_packet_v1", {
    p_order_id: point38OrderId,
    p_transport_snapshot: {
      transporter: "POINT100 SYNTHETIC CARRIER",
      transport_mode: "ROAD",
      lr_awb_bilty: "P100-LR-POINT38-CANONICAL",
      vehicle_number: "DL01P1000",
      driver_name: "Point100 Synthetic Driver",
      driver_phone: "9999999999",
      tracking_reference: trackingReference,
    },
    p_evidence_references: ["point100:disposable-synthetic:gate:point38"],
    p_dispatched_at: dispatchedAt,
    p_correlation_id: proofIdentity,
    p_idempotency_key: proofIdentity,
    p_actor_id: gateRole.actorId,
  });
  assertNoError(proofError, "Point38 tail immutable dispatch proof");
  const dispatchProofId = String(firstRow(proofData)?.dispatch_proof_id ?? "");
  if (!dispatchProofId) throw new Error("POINT100_POINT38_TAIL_DISPATCH_PROOF_ID_MISSING");

  const { data: finalizeData, error: finalizeError } = await gateRole.client.rpc("release_order_to_dispatched_v1", {
    p_order_id: point38OrderId,
    p_tracking_number: trackingReference,
    p_courier_name: "POINT100 SYNTHETIC CARRIER",
    p_finalize_reason: "Point100 disposable software rehearsal finalization",
    p_correlation_id: `${RUN_TOKEN}:dispatch-finalize`,
  });
  assertNoError(finalizeError, "Point38 tail canonical dispatch finalization");
  const finalize = firstRow(finalizeData) ?? finalizeData;
  if (finalize?.ok !== true || finalize?.new_status !== "dispatched") {
    throw new Error(`POINT100_POINT38_TAIL_FINALIZE_BLOCKED: ${JSON.stringify(finalize)}`);
  }

  const { data: exitFactsData, error: exitFactsError } = await gateRole.client.rpc("get_finance_exit_facts_v1", {
    p_order_id: point38OrderId,
  });
  assertNoError(exitFactsError, "Point38 tail final finance-exit verification");
  const exitFacts = firstRow(exitFactsData);
  if (
    !exitFacts ||
    exitFacts.order_status !== "dispatched" ||
    String(exitFacts.dispatch_proof_id ?? "") !== dispatchProofId ||
    exitFacts.dispatch_cleared !== true ||
    exitFacts.complaint_clock_basis !== "FINAL_INVOICE_DATE" ||
    typeof exitFacts.complaint_window_open !== "boolean"
  ) {
    throw new Error(`POINT100_POINT38_TAIL_FINAL_FACTS_INVALID: ${JSON.stringify(exitFacts)}`);
  }

  console.log("Point100 Point38 canonical Gate -> dispatch proof -> finalization tail prepared on disposable Core authority.");
} finally {
  await Promise.allSettled([
    dispatchRole.client.auth.signOut(),
    gateRole.client.auth.signOut(),
  ]);
}
