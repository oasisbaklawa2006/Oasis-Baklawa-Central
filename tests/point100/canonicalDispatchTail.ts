import { expect, type Page } from "@playwright/test";
import {
  createAuthenticatedCertificationClient,
  createSteppedUpCertificationClient,
  credentialsForRoleOrSkip,
  switchRole,
} from "./support";

export type CanonicalDispatchTailResult = {
  orderId: string;
  orderItemId: string;
  consignmentId: string;
  cartonId: string;
  cartonCode: string;
  financeDplReceiptId: string;
  finalInvoiceId: string;
  finalInvoiceGrossTotal: number;
  financeDispatchClearanceEventId: string;
  gateDecisionOk: true;
  dispatchProofId: string;
  dispatchFinalizationOk: true;
  finalOrderStatus: string;
  complaintClockBasis: string;
  complaintDeadline: string;
  complaintWindowOpen: boolean;
};

type JsonObject = Record<string, unknown>;

function firstRow(data: unknown): JsonObject {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") throw new Error("Governed RPC returned no row");
  return row as JsonObject;
}

function requireString(value: unknown, label: string): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) throw new Error(`${label} missing`);
  return text;
}

function requireNumber(value: unknown, label: string): number {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) throw new Error(`${label} missing/invalid`);
  return number;
}

async function verifyPayment(
  client: Awaited<ReturnType<typeof createSteppedUpCertificationClient>>,
  paymentId: string,
  amount: number,
  actorId: string,
  identity: string,
) {
  const { error } = await client.rpc("verify_order_payment_v1", {
    p_payment_id: paymentId,
    p_verified_amount: amount,
    p_verified_reference: `POINT100-VERIFY-${identity}`,
    p_verification_evidence_reference: `point100:verify:${identity}`,
    p_reason: "Point100 disposable software rehearsal payment verification",
    p_correlation_id: `central:pf6a:verify:${identity}`,
    p_idempotency_key: `central:pf6a:verify:${identity}`,
    p_actor_id: actorId,
  });
  expect(error, error?.message).toBeNull();
}

async function recordPayment(
  client: Awaited<ReturnType<typeof createSteppedUpCertificationClient>>,
  input: {
    orderId: string;
    piId: string;
    commercialVersionId: string;
    paymentType: "advance" | "balance";
    amount: number;
    actorId: string;
    identity: string;
  },
): Promise<string> {
  const { data, error } = await client.rpc("record_order_payment_proof_v1", {
    p_order_id: input.orderId,
    p_pi_id: input.piId,
    p_commercial_version_id: input.commercialVersionId,
    p_payment_type: input.paymentType,
    p_submitted_amount: input.amount,
    p_currency: "INR",
    p_payment_mode: "bank_transfer",
    p_external_reference: `POINT100-${input.identity}`,
    p_payer_reference: null,
    p_proof_evidence_reference: `point100:payment:${input.identity}`,
    p_source_channel: "CENTRAL",
    p_source_reference: `point100:${input.orderId}`,
    p_correlation_id: `central:pf6a:proof:${input.identity}`,
    p_idempotency_key: `central:pf6a:proof:${input.identity}`,
    p_actor_id: input.actorId,
  });
  expect(error, error?.message).toBeNull();
  return requireString(firstRow(data).payment_id, "payment_id");
}

type FinanceClient = Awaited<ReturnType<typeof createSteppedUpCertificationClient>>;

async function resolvePiBinding(finance: FinanceClient, orderId: string) {
  const { data: piRows, error: piError } = await finance
    .from("sales_order_proforma_invoice_authority_v1")
    .select("id,commercial_version_id,status")
    .eq("order_id", orderId)
    .in("status", ["READY_FOR_ISSUE", "ISSUED"])
    .limit(1);
  expect(piError, piError?.message).toBeNull();
  expect(piRows?.length ?? 0, "Point100 dispatch fixture requires PI binding").toBeGreaterThan(0);
  return {
    piId: requireString(piRows?.[0]?.id, "PI id"),
    commercialVersionId: requireString(piRows?.[0]?.commercial_version_id, "commercial version id"),
  };
}

async function ensureOperationsClearanceForTail(
  finance: FinanceClient,
  orderId: string,
  piId: string,
  commercialVersionId: string,
  financeActorId: string,
  runSuffix: string,
) {
  const { data: opsFactsData, error: opsFactsError } = await finance.rpc("get_finance_operations_clearance_facts_v1", {
    p_order_id: orderId,
    p_pi_id: piId,
    p_commercial_version_id: commercialVersionId,
  });
  expect(opsFactsError, opsFactsError?.message).toBeNull();
  let opsFacts = firstRow(opsFactsData);
  if (opsFacts.eligible_for_operations_clearance !== true) {
    const requiredAdvance = Math.max(1, requireNumber(opsFacts.required_advance ?? 1, "required advance"));
    const identity = `p100-${runSuffix}-dispatch-advance`;
    const paymentId = await recordPayment(finance, {
      orderId,
      piId,
      commercialVersionId,
      paymentType: "advance",
      amount: requiredAdvance,
      actorId: financeActorId,
      identity,
    });
    await verifyPayment(finance, paymentId, requiredAdvance, financeActorId, identity);
    const refreshed = await finance.rpc("get_finance_operations_clearance_facts_v1", {
      p_order_id: orderId,
      p_pi_id: piId,
      p_commercial_version_id: commercialVersionId,
    });
    expect(refreshed.error, refreshed.error?.message).toBeNull();
    opsFacts = firstRow(refreshed.data);
  }
  if (opsFacts.latest_clearance_decision !== "GRANTED") {
    const identity = `p100-${runSuffix}-ops-clearance`;
    const { error } = await finance.rpc("decide_finance_operations_clearance_v1", {
      p_order_id: orderId,
      p_pi_id: piId,
      p_commercial_version_id: commercialVersionId,
      p_decision: "GRANTED",
      p_reason: "Point100 disposable software rehearsal operations clearance",
      p_evidence_reference: `point100:ops-clearance:${runSuffix}`,
      p_source_channel: "CENTRAL",
      p_source_reference: `point100:${orderId}`,
      p_correlation_id: `central:pf6c:point100:${identity}`,
      p_idempotency_key: `central:pf6c:point100:${identity}`,
      p_actor_id: financeActorId,
    });
    expect(error, error?.message).toBeNull();
  }
}

async function buildDispatchCustodyForTail(
  page: Page,
  orderId: string,
  orderItemId: string,
  runSuffix: string,
  dispatchManager: ReturnType<typeof credentialsForRoleOrSkip>,
  hodAssembly: ReturnType<typeof credentialsForRoleOrSkip>,
) {
  await switchRole(page, dispatchManager);
  let { client: dispatch } = await createAuthenticatedCertificationClient(page);
  const { data: orderItem, error: itemError } = await dispatch
    .from("order_items")
    .select("quantity")
    .eq("id", orderItemId)
    .eq("order_id", orderId)
    .single();
  expect(itemError, itemError?.message).toBeNull();
  const dispatchQty = requireNumber(orderItem?.quantity, "dispatch quantity");
  expect(dispatchQty).toBeGreaterThan(0);

  const consignmentCorrelation = `point100-${runSuffix}-consignment`;
  const { data: consignmentData, error: consignmentError } = await dispatch.rpc("create_b2b_dispatch_consignment", {
    p_order_id: orderId,
    p_dispatch_mode: "road_transporter",
    p_lines: [{ order_item_id: orderItemId, selected_qty: dispatchQty }],
    p_correlation_id: consignmentCorrelation,
  });
  expect(consignmentError, consignmentError?.message).toBeNull();
  const consignmentId = requireString((consignmentData as JsonObject | null)?.id, "consignment id");

  const cartonCode = `P100-${runSuffix}-C1`.slice(0, 80);
  const { data: cartonData, error: cartonError } = await dispatch.rpc("open_b2b_dispatch_carton", {
    p_consignment_id: consignmentId,
    p_carton_code: cartonCode,
  });
  expect(cartonError, cartonError?.message).toBeNull();
  const cartonId = requireString((cartonData as JsonObject | null)?.id, "carton id");

  // Synthetic custody input: this exercises role separation and server custody
  // contracts but must never be interpreted as physical handover evidence.
  await switchRole(page, hodAssembly);
  const { client: assembly } = await createAuthenticatedCertificationClient(page);
  const handoffCorrelation = `point100-${runSuffix}-synthetic-handoff`;
  const { data: handoffData, error: handoffError } = await assembly.rpc("declare_b2b_dispatch_source_handoff", {
    p_consignment_id: consignmentId,
    p_source_department: "PACKING_ASSEMBLY",
    p_source_location: "POINT100_DISPOSABLE_SYNTHETIC",
    p_lines: [{ order_item_id: orderItemId, declared_qty: dispatchQty }],
    p_correlation_id: handoffCorrelation,
  });
  expect(handoffError, handoffError?.message).toBeNull();
  const handoffId = requireString((handoffData as JsonObject | null)?.id, "handoff id");

  await switchRole(page, dispatchManager);
  ({ client: dispatch } = await createAuthenticatedCertificationClient(page));
  const { error: receiptError } = await dispatch.rpc("record_b2b_dispatch_handoff_receipt", {
    p_handoff_id: handoffId,
    p_lines: [{ order_item_id: orderItemId, physically_received_qty: dispatchQty }],
    p_correlation_id: `point100-${runSuffix}-synthetic-handoff-receipt`,
  });
  expect(receiptError, receiptError?.message).toBeNull();
  const { error: acceptError } = await dispatch.rpc("accept_b2b_dispatch_handoff", {
    p_handoff_id: handoffId,
    p_lines: [{ order_item_id: orderItemId, accepted_qty: dispatchQty, held_qty: 0, rejected_qty: 0 }],
    p_correlation_id: `point100-${runSuffix}-synthetic-handoff-accept`,
  });
  expect(acceptError, acceptError?.message).toBeNull();

  const { data: lineData, error: lineError } = await dispatch
    .from("b2b_dispatch_consignment_lines")
    .select("id")
    .eq("consignment_id", consignmentId)
    .eq("order_item_id", orderItemId)
    .single();
  expect(lineError, lineError?.message).toBeNull();
  const consignmentLineId = requireString(lineData?.id, "consignment line id");

  const { data: scanData, error: scanError } = await dispatch.rpc("record_b2b_dispatch_carton_item_scan", {
    p_carton_id: cartonId,
    p_consignment_line_id: consignmentLineId,
    p_barcode_value: "CERT-ARABIC-001",
    p_batch_lot: `P100-SYNTHETIC-${runSuffix}`,
    p_quantity: dispatchQty,
    p_correlation_id: `point100-${runSuffix}-synthetic-carton-scan`,
  });
  expect(scanError, scanError?.message).toBeNull();
  expect((scanData as JsonObject | null)?.scan_result, "synthetic software scan must satisfy canonical packing contract").toBe("verified");

  const { error: cartonEvidenceError } = await dispatch.rpc("record_b2b_dispatch_carton_evidence", {
    p_carton_id: cartonId,
    p_net_weight: dispatchQty,
    p_gross_weight: dispatchQty + 0.5,
    p_open_photo_ref: `point100://disposable-synthetic/carton/${runSuffix}`,
    p_correlation_id: `point100-${runSuffix}-synthetic-carton-evidence`,
  });
  expect(cartonEvidenceError, cartonEvidenceError?.message).toBeNull();
  const { data: cartonBeforeLock, error: cartonBeforeLockError } = await dispatch
    .from("b2b_dispatch_cartons")
    .select("current_version")
    .eq("id", cartonId)
    .single();
  expect(cartonBeforeLockError, cartonBeforeLockError?.message).toBeNull();
  const { error: lockError } = await dispatch.rpc("lock_b2b_dispatch_carton", {
    p_carton_id: cartonId,
    p_expected_version: cartonBeforeLock?.current_version,
    p_correlation_id: `point100-${runSuffix}-carton-lock`,
  });
  expect(lockError, lockError?.message).toBeNull();

  const { data: dplData, error: dplError } = await dispatch.rpc("create_b2b_dispatch_packing_list", {
    p_consignment_id: consignmentId,
    p_correlation_id: `point100-${runSuffix}-dpl-create`,
  });
  expect(dplError, dplError?.message).toBeNull();
  const dplVersionId = requireString((dplData as JsonObject | null)?.id, "DPL version id");
  const { error: submitDplError } = await dispatch.rpc("submit_b2b_dispatch_packing_list_to_finance", {
    p_consignment_id: consignmentId,
    p_version_id: dplVersionId,
    p_correlation_id: `point100-${runSuffix}-dpl-submit`,
  });
  expect(submitDplError, submitDplError?.message).toBeNull();
  return { consignmentId, cartonId, cartonCode };
}

async function issueFinanceExitForTail(
  finance: FinanceClient,
  orderId: string,
  piId: string,
  commercialVersionId: string,
  financeActorId: string,
  runSuffix: string,
) {
  const { data: receiptData, error: financeReceiptError } = await finance.rpc("receive_submitted_b2b_dispatch_dpls_v1", {
    p_order_id: orderId,
    p_evidence_reference: `point100:dpl-receipt:${runSuffix}`,
    p_correlation_id: `point100-${runSuffix}-finance-dpl-receipt`,
    p_idempotency_key: `point100-${runSuffix}-finance-dpl-receipt`,
    p_actor_id: financeActorId,
  });
  expect(financeReceiptError, financeReceiptError?.message).toBeNull();
  const financeDplReceiptId = requireString(firstRow(receiptData).receipt_id, "Finance DPL receipt id");

  const invoiceIdentity = `point100-${runSuffix}-final-invoice`;
  const invoiceDate = new Date().toISOString().slice(0, 10);
  const { data: invoiceData, error: invoiceError } = await finance.rpc("issue_final_invoice_v1", {
    p_order_id: orderId,
    p_pi_id: piId,
    p_commercial_version_id: commercialVersionId,
    p_finance_dpl_receipt_id: financeDplReceiptId,
    p_invoice_number: `P100-${runSuffix}`.slice(0, 64),
    p_invoice_date: invoiceDate,
    p_document_reference: `point100://disposable-synthetic/invoice/${runSuffix}`,
    p_reason: "Point100 disposable software rehearsal final invoice",
    p_correlation_id: invoiceIdentity,
    p_idempotency_key: invoiceIdentity,
    p_actor_id: financeActorId,
  });
  expect(invoiceError, invoiceError?.message).toBeNull();
  const invoiceRow = firstRow(invoiceData);
  const finalInvoiceId = requireString(invoiceRow.final_invoice_id, "final invoice id");
  const finalInvoiceGrossTotal = requireNumber(invoiceRow.gross_total, "final invoice gross total");

  let settlement = await finance.rpc("get_final_settlement_facts_v1", { p_final_invoice_id: finalInvoiceId });
  expect(settlement.error, settlement.error?.message).toBeNull();
  let settlementFacts = firstRow(settlement.data);
  let netDue = requireNumber(settlementFacts.net_due ?? 0, "final settlement net due");
  if (netDue > 0.01) {
    const identity = `p100-${runSuffix}-final-balance`;
    const paymentId = await recordPayment(finance, {
      orderId,
      piId,
      commercialVersionId,
      paymentType: "balance",
      amount: netDue,
      actorId: financeActorId,
      identity,
    });
    await verifyPayment(finance, paymentId, netDue, financeActorId, identity);
    settlement = await finance.rpc("get_final_settlement_facts_v1", { p_final_invoice_id: finalInvoiceId });
    expect(settlement.error, settlement.error?.message).toBeNull();
    settlementFacts = firstRow(settlement.data);
    netDue = requireNumber(settlementFacts.net_due ?? 0, "refreshed final settlement net due");
  }
  expect(netDue, "final invoice balance must be settled before dispatch clearance").toBeLessThanOrEqual(0.01);
  expect(settlementFacts.settled_for_dispatch).toBe(true);

  const ewayIdentity = `point100-${runSuffix}-eway`;
  const { error: ewayError } = await finance.rpc("record_eway_bill_evidence_v1", {
    p_final_invoice_id: finalInvoiceId,
    p_status: "NOT_REQUIRED",
    p_eway_bill_number: null,
    p_document_reference: null,
    p_policy_reason: "Point100 disposable order below governed E-way requirement for software rehearsal",
    p_valid_from: null,
    p_valid_until: null,
    p_correlation_id: ewayIdentity,
    p_idempotency_key: ewayIdentity,
    p_actor_id: financeActorId,
  });
  expect(ewayError, ewayError?.message).toBeNull();

  const clearanceIdentity = `point100-${runSuffix}-dispatch-clearance`;
  const { data: clearanceData, error: clearanceError } = await finance.rpc("decide_finance_dispatch_clearance_v1", {
    p_final_invoice_id: finalInvoiceId,
    p_decision: "GRANTED",
    p_reason: "Point100 disposable software rehearsal dispatch clearance",
    p_evidence_reference: `point100:dispatch-clearance:${runSuffix}`,
    p_correlation_id: clearanceIdentity,
    p_idempotency_key: clearanceIdentity,
    p_actor_id: financeActorId,
  });
  expect(clearanceError, clearanceError?.message).toBeNull();
  const financeDispatchClearanceEventId = requireString(firstRow(clearanceData).clearance_event_id, "dispatch clearance event id");
  return {
    financeDplReceiptId,
    finalInvoiceId,
    finalInvoiceGrossTotal,
    financeDispatchClearanceEventId,
  };
}

async function executeGateTailForTail(
  page: Page,
  orderId: string,
  cartonId: string,
  cartonCode: string,
  runSuffix: string,
  gateSecurity: ReturnType<typeof credentialsForRoleOrSkip>,
) {
  await switchRole(page, gateSecurity);
  const { client: gate } = await createAuthenticatedCertificationClient(page);
  const gateActorId = requireString((await gate.auth.getUser()).data.user?.id, "GATE_SECURITY actor id");
  const gateScanCorrelation = `point100-${runSuffix}-synthetic-gate-scan`;
  const { data: gateScan, error: gateScanError } = await gate
    .from("operational_scan_records")
    .insert({
      scan_type: "dispatch_gate",
      verification_type: "gate_check",
      entity_type: "dispatch_carton",
      entity_id: cartonId,
      order_id: orderId,
      barcode_value: cartonCode,
      expected_barcode: cartonCode,
      verification_status: "scanned",
      scan_source: "point100_disposable_synthetic_gate",
      actor_id: gateActorId,
      actor_role: "GATE_SECURITY",
      correlation_id: gateScanCorrelation,
      metadata: { certification_mode: "disposable_synthetic", physical_uat: false },
    })
    .select("id")
    .single();
  expect(gateScanError, gateScanError?.message).toBeNull();
  const gateScanId = requireString(gateScan?.id, "gate scan evidence id");
  const { data: gateDecisionData, error: gateDecisionError } = await gate.rpc("release_b2b_dispatch_carton_at_gate_v1", {
    p_carton_id: cartonId,
    p_scan_evidence_id: gateScanId,
  });
  expect(gateDecisionError, gateDecisionError?.message).toBeNull();
  const gateDecision = gateDecisionData as { ok?: boolean; blockers?: unknown } | null;
  expect(gateDecision?.ok, `gate blockers=${JSON.stringify(gateDecision?.blockers ?? [])}`).toBe(true);
  const { error: gateVerifyError } = await gate
    .from("operational_scan_records")
    .update({ verification_status: "verified" })
    .eq("id", gateScanId);
  expect(gateVerifyError, gateVerifyError?.message).toBeNull();

  const dispatchedAt = new Date().toISOString();
  const trackingReference = `P100-TRK-${runSuffix}`.slice(0, 96);
  const proofIdentity = `point100-${runSuffix}-dispatch-proof`;
  const { data: proofData, error: proofError } = await gate.rpc("record_dispatch_proof_packet_v1", {
    p_order_id: orderId,
    p_transport_snapshot: {
      transporter: "POINT100 SYNTHETIC CARRIER",
      transport_mode: "ROAD",
      lr_awb_bilty: `P100-LR-${runSuffix}`.slice(0, 96),
      vehicle_number: "DL01P1000",
      driver_name: "Point100 Synthetic Driver",
      driver_phone: "9999999999",
      tracking_reference: trackingReference,
    },
    p_evidence_references: [`point100:disposable-synthetic:gate:${runSuffix}`],
    p_dispatched_at: dispatchedAt,
    p_correlation_id: proofIdentity,
    p_idempotency_key: proofIdentity,
    p_actor_id: gateActorId,
  });
  expect(proofError, proofError?.message).toBeNull();
  const dispatchProofId = requireString(firstRow(proofData).dispatch_proof_id, "dispatch proof id");

  const { data: finalizeData, error: finalizeError } = await gate.rpc("release_order_to_dispatched_v1", {
    p_order_id: orderId,
    p_tracking_number: trackingReference,
    p_courier_name: "POINT100 SYNTHETIC CARRIER",
    p_finalize_reason: "Point100 disposable software rehearsal finalization",
    p_correlation_id: `point100-${runSuffix}-dispatch-finalize`,
  });
  expect(finalizeError, finalizeError?.message).toBeNull();
  const finalize = finalizeData as { ok?: boolean; new_status?: string; blockers?: unknown } | null;
  expect(finalize?.ok, `dispatch finalization blockers=${JSON.stringify(finalize?.blockers ?? [])}`).toBe(true);
  expect(finalize?.new_status).toBe("dispatched");

  const { data: finalFactsData, error: finalFactsError } = await gate.rpc("get_finance_exit_facts_v1", { p_order_id: orderId });
  expect(finalFactsError, finalFactsError?.message).toBeNull();
  const finalFacts = firstRow(finalFactsData);
  const finalOrderStatus = requireString(finalFacts.order_status, "final order status");
  const complaintClockBasis = requireString(finalFacts.complaint_clock_basis, "complaint clock basis");
  const complaintDeadline = requireString(finalFacts.complaint_deadline, "complaint deadline");
  const complaintWindowOpen = finalFacts.complaint_window_open;
  expect(finalOrderStatus).toBe("dispatched");
  expect(complaintClockBasis).toBe("FINAL_INVOICE_DATE");
  expect(typeof complaintWindowOpen).toBe("boolean");
  expect(finalFacts.dispatch_proof_id).toBe(dispatchProofId);
  expect(finalFacts.dispatch_cleared).toBe(true);
  return {
    dispatchProofId,
    finalOrderStatus,
    complaintClockBasis,
    complaintDeadline,
    complaintWindowOpen: complaintWindowOpen as boolean,
  };
}

/**
 * Execute Point100's canonical software-only Finance -> B2B Dispatch -> Gate ->
 * immutable dispatch proof -> final order dispatch tail on the disposable Core
 * stack. Inputs that represent a real-world handoff/scan are explicitly marked
 * synthetic and prove only that the governed software consumes valid evidence;
 * they are never physical UAT evidence.
 */
export async function executeCanonicalDispatchTail(input: {
  page: Page;
  orderId: string;
  orderItemId: string;
  runSuffix: string;
}): Promise<CanonicalDispatchTailResult> {
  const { page, orderId, orderItemId, runSuffix } = input;
  const financeHead = credentialsForRoleOrSkip("FINANCE_HEAD");
  const dispatchManager = credentialsForRoleOrSkip("DISPATCH_MANAGER");
  const hodAssembly = credentialsForRoleOrSkip("HOD_ASSEMBLY");
  const gateSecurity = credentialsForRoleOrSkip("GATE_SECURITY");

  await switchRole(page, financeHead);
  const finance = await createSteppedUpCertificationClient(page, "FINANCE_HEAD");
  const financeActorId = requireString((await finance.auth.getUser()).data.user?.id, "FINANCE_HEAD actor id");
  const { piId, commercialVersionId } = await resolvePiBinding(finance, orderId);
  await ensureOperationsClearanceForTail(finance, orderId, piId, commercialVersionId, financeActorId, runSuffix);

  const custody = await buildDispatchCustodyForTail(
    page,
    orderId,
    orderItemId,
    runSuffix,
    dispatchManager,
    hodAssembly,
  );

  await switchRole(page, financeHead);
  const financeAfterCustody = await createSteppedUpCertificationClient(page, "FINANCE_HEAD");
  const financeExit = await issueFinanceExitForTail(
    financeAfterCustody,
    orderId,
    piId,
    commercialVersionId,
    financeActorId,
    runSuffix,
  );

  const gateTail = await executeGateTailForTail(
    page,
    orderId,
    custody.cartonId,
    custody.cartonCode,
    runSuffix,
    gateSecurity,
  );

  return {
    orderId,
    orderItemId,
    consignmentId: custody.consignmentId,
    cartonId: custody.cartonId,
    cartonCode: custody.cartonCode,
    financeDplReceiptId: financeExit.financeDplReceiptId,
    finalInvoiceId: financeExit.finalInvoiceId,
    finalInvoiceGrossTotal: financeExit.finalInvoiceGrossTotal,
    financeDispatchClearanceEventId: financeExit.financeDispatchClearanceEventId,
    gateDecisionOk: true,
    dispatchProofId: gateTail.dispatchProofId,
    dispatchFinalizationOk: true,
    finalOrderStatus: gateTail.finalOrderStatus,
    complaintClockBasis: gateTail.complaintClockBasis,
    complaintDeadline: gateTail.complaintDeadline,
    complaintWindowOpen: gateTail.complaintWindowOpen,
  };
}
