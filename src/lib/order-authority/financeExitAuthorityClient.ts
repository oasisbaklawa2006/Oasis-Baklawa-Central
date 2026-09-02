import { supabase } from "@/integrations/supabase/client";

type RpcError = { message: string; code?: string; details?: string };

export class FinanceExitAuthorityError extends Error {
  readonly code?: string;
  constructor(error: RpcError | string) {
    super(typeof error === "string" ? error : error.message);
    this.name = "FinanceExitAuthorityError";
    if (typeof error !== "string") this.code = error.code;
  }
}

function required(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new FinanceExitAuthorityError(`${field} is required`);
  return normalized;
}
function row(data: unknown, op: string): Record<string, unknown> {
  const value = Array.isArray(data) ? data[0] : data;
  if (!value || typeof value !== "object") throw new FinanceExitAuthorityError(`${op} returned no governed result`);
  return value as Record<string, unknown>;
}
function governed(data: unknown, error: RpcError | null, op: string): unknown {
  if (error) throw new FinanceExitAuthorityError(error);
  if (data == null) throw new FinanceExitAuthorityError(`${op} returned no governed result`);
  return data;
}
async function sha256(value: string): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new FinanceExitAuthorityError("Web Crypto SHA-256 is unavailable");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
async function ids(scope: string, identity: unknown) {
  const normalized = JSON.stringify(identity);
  return {
    correlationId: `central:finance-exit:${scope}:${await sha256(`correlation:${normalized}`)}`,
    idempotencyKey: `central:finance-exit:${scope}:${await sha256(`idempotency:${normalized}`)}`,
  };
}

export type FinanceExitFacts = {
  orderId: string;
  companyId: string;
  orderStatus: string;
  financeDplReceiptId: string | null;
  financeDplSourceAuthority: string | null;
  commercialVersionId: string | null;
  piId: string | null;
  finalInvoiceId: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  invoiceGrossTotal: number | null;
  settlement: Record<string, unknown> | null;
  ewayEvidenceId: string | null;
  ewayStatus: string | null;
  ewayBillNumber: string | null;
  dispatchClearanceEventId: string | null;
  dispatchClearanceDecision: string | null;
  dispatchCleared: boolean;
  dispatchProofId: string | null;
  dispatchedAt: string | null;
  complaintClockBasis: string | null;
  complaintDeadline: string | null;
  complaintWindowOpen: boolean | null;
};

export type DispatchTransportMode = "ROAD" | "COURIER" | "AIR" | "RAIL" | "HAND_CARRY" | "CUSTOMER_PICKUP" | "OTHER";

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
function numberOrNull(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
}

export async function getFinanceExitFacts(orderId: string): Promise<FinanceExitFacts> {
  const { data, error } = await supabase.rpc("get_finance_exit_facts_v1", { p_order_id: required(orderId, "order id") });
  const value = row(governed(data, error, "getFinanceExitFacts"), "getFinanceExitFacts");
  if (value.payment_verified_is_not_clearance !== true) throw new FinanceExitAuthorityError("Core did not preserve payment/clearance separation");
  const finalInvoiceId = optionalString(value.final_invoice_id);
  const complaintClockBasis = optionalString(value.complaint_clock_basis);
  if (finalInvoiceId && complaintClockBasis !== "FINAL_INVOICE_DATE") {
    throw new FinanceExitAuthorityError("Core complaint window is not anchored to final invoice date");
  }
  return {
    orderId: required(String(value.order_id ?? ""), "Core order id"),
    companyId: required(String(value.company_id ?? ""), "Core company id"),
    orderStatus: required(String(value.order_status ?? ""), "Core order status"),
    financeDplReceiptId: optionalString(value.finance_dpl_receipt_id),
    financeDplSourceAuthority: optionalString(value.finance_dpl_source_authority),
    commercialVersionId: optionalString(value.commercial_version_id),
    piId: optionalString(value.pi_id),
    finalInvoiceId,
    invoiceNumber: optionalString(value.invoice_number),
    invoiceDate: optionalString(value.invoice_date),
    invoiceGrossTotal: numberOrNull(value.invoice_gross_total),
    settlement: value.settlement && typeof value.settlement === "object" ? value.settlement as Record<string, unknown> : null,
    ewayEvidenceId: optionalString(value.eway_evidence_id),
    ewayStatus: optionalString(value.eway_status),
    ewayBillNumber: optionalString(value.eway_bill_number),
    dispatchClearanceEventId: optionalString(value.dispatch_clearance_event_id),
    dispatchClearanceDecision: optionalString(value.dispatch_clearance_decision),
    dispatchCleared: value.dispatch_cleared === true,
    dispatchProofId: optionalString(value.dispatch_proof_id),
    dispatchedAt: optionalString(value.dispatched_at),
    complaintClockBasis,
    complaintDeadline: optionalString(value.complaint_deadline),
    complaintWindowOpen: typeof value.complaint_window_open === "boolean" ? value.complaint_window_open : null,
  };
}

export async function receiveSubmittedB2bDpls(orderId: string, evidenceReference: string, actorId: string) {
  const normalized = {
    orderId: required(orderId, "order id"),
    evidenceReference: required(evidenceReference, "DPL evidence reference"),
    actorId: required(actorId, "actor id"),
  };
  const identityIds = await ids("dpl-receipt", [normalized.orderId, normalized.evidenceReference, normalized.actorId]);
  const { data, error } = await supabase.rpc("receive_submitted_b2b_dispatch_dpls_v1", {
    p_order_id: normalized.orderId,
    p_evidence_reference: normalized.evidenceReference,
    p_correlation_id: identityIds.correlationId,
    p_idempotency_key: identityIds.idempotencyKey,
    p_actor_id: normalized.actorId,
  });
  return row(governed(data, error, "receiveSubmittedB2bDpls"), "receiveSubmittedB2bDpls");
}

export async function issueFinalInvoice(input: {
  orderId: string; piId: string; commercialVersionId: string; financeDplReceiptId: string;
  invoiceNumber: string; invoiceDate: string; documentReference: string; reason: string; actorId: string;
}) {
  const normalized = {
    orderId: required(input.orderId,"order id"),
    piId: required(input.piId,"PI id"),
    commercialVersionId: required(input.commercialVersionId,"commercial version id"),
    financeDplReceiptId: required(input.financeDplReceiptId,"Finance DPL receipt id"),
    invoiceNumber: required(input.invoiceNumber,"invoice number"),
    invoiceDate: required(input.invoiceDate,"invoice date"),
    documentReference: required(input.documentReference,"invoice document reference"),
    reason: required(input.reason,"reason"),
    actorId: required(input.actorId,"actor id"),
  };
  const identityIds = await ids("final-invoice", Object.values(normalized));
  const { data, error } = await supabase.rpc("issue_final_invoice_v1", {
    p_order_id: normalized.orderId, p_pi_id: normalized.piId,
    p_commercial_version_id: normalized.commercialVersionId,
    p_finance_dpl_receipt_id: normalized.financeDplReceiptId,
    p_invoice_number: normalized.invoiceNumber, p_invoice_date: normalized.invoiceDate,
    p_document_reference: normalized.documentReference, p_reason: normalized.reason,
    p_correlation_id: identityIds.correlationId, p_idempotency_key: identityIds.idempotencyKey, p_actor_id: normalized.actorId,
  });
  return row(governed(data, error, "issueFinalInvoice"), "issueFinalInvoice");
}

export async function recordEwayEvidence(input: {
  finalInvoiceId: string; status: "VALIDATED" | "NOT_REQUIRED"; ewayBillNumber?: string | null; documentReference?: string | null;
  policyReason: string; validFrom?: string | null; validUntil?: string | null; actorId: string;
}) {
  const normalized = {
    finalInvoiceId: required(input.finalInvoiceId,"final invoice id"),
    ewayBillNumber: input.ewayBillNumber?.trim() || null,
    documentReference: input.documentReference?.trim() || null,
    policyReason: required(input.policyReason,"E-way policy reason"),
    validFrom: input.validFrom?.trim() || null,
    validUntil: input.validUntil?.trim() || null,
    actorId: required(input.actorId,"actor id"),
  };
  const identityIds = await ids("eway", [normalized.finalInvoiceId,input.status,normalized.ewayBillNumber,normalized.documentReference,normalized.policyReason,normalized.validFrom,normalized.validUntil,normalized.actorId]);
  const { data, error } = await supabase.rpc("record_eway_bill_evidence_v1", {
    p_final_invoice_id: normalized.finalInvoiceId, p_status: input.status,
    p_eway_bill_number: normalized.ewayBillNumber, p_document_reference: normalized.documentReference,
    p_policy_reason: normalized.policyReason, p_valid_from: normalized.validFrom, p_valid_until: normalized.validUntil,
    p_correlation_id: identityIds.correlationId, p_idempotency_key: identityIds.idempotencyKey, p_actor_id: normalized.actorId,
  });
  return row(governed(data, error, "recordEwayEvidence"), "recordEwayEvidence");
}

export async function decideFinanceDispatchClearance(input: {
  finalInvoiceId: string; decision: "GRANTED" | "DENIED" | "REVOKED"; reason: string; evidenceReference: string; actorId: string;
}) {
  const normalized = {
    finalInvoiceId: required(input.finalInvoiceId,"final invoice id"),
    reason: required(input.reason,"reason"),
    evidenceReference: required(input.evidenceReference,"evidence reference"),
    actorId: required(input.actorId,"actor id"),
  };
  const identityIds = await ids("dispatch-clearance", [normalized.finalInvoiceId,input.decision,normalized.reason,normalized.evidenceReference,normalized.actorId]);
  const { data, error } = await supabase.rpc("decide_finance_dispatch_clearance_v1", {
    p_final_invoice_id: normalized.finalInvoiceId, p_decision: input.decision,
    p_reason: normalized.reason, p_evidence_reference: normalized.evidenceReference,
    p_correlation_id: identityIds.correlationId, p_idempotency_key: identityIds.idempotencyKey, p_actor_id: normalized.actorId,
  });
  return row(governed(data, error, "decideFinanceDispatchClearance"), "decideFinanceDispatchClearance");
}

export async function recordDispatchProof(input: {
  orderId: string;
  transporter: string;
  transportMode: DispatchTransportMode;
  lrAwbBilty: string;
  vehicleNumber?: string | null;
  driverName?: string | null;
  driverPhone?: string | null;
  trackingReference?: string | null;
  evidenceReferences: string[];
  dispatchedAt: string;
  actorId: string;
}) {
  const normalized = {
    orderId: required(input.orderId,"order id"),
    transporter: required(input.transporter,"transporter"),
    transportMode: input.transportMode,
    lrAwbBilty: required(input.lrAwbBilty,"LR/AWB/Bilty"),
    vehicleNumber: input.vehicleNumber?.trim() || null,
    driverName: input.driverName?.trim() || null,
    driverPhone: input.driverPhone?.trim() || null,
    trackingReference: input.trackingReference?.trim() || null,
    dispatchedAt: required(input.dispatchedAt,"dispatch timestamp"),
    actorId: required(input.actorId,"actor id"),
  };
  if (!normalized.transportMode) throw new FinanceExitAuthorityError("transport mode is required");
  if (["ROAD", "CUSTOMER_PICKUP"].includes(normalized.transportMode) && !normalized.vehicleNumber) {
    throw new FinanceExitAuthorityError("vehicle number is required for road/customer-pickup dispatch");
  }
  if (normalized.transportMode === "ROAD" && (!normalized.driverName || !normalized.driverPhone)) {
    throw new FinanceExitAuthorityError("driver name and phone are required for road dispatch");
  }
  const evidenceReferences = input.evidenceReferences.map((reference) => required(reference, "dispatch evidence reference"));
  if (evidenceReferences.length === 0) throw new FinanceExitAuthorityError("dispatch evidence is required");
  const transportSnapshot = {
    transporter: normalized.transporter,
    transport_mode: normalized.transportMode,
    lr_awb_bilty: normalized.lrAwbBilty,
    vehicle_number: normalized.vehicleNumber,
    driver_name: normalized.driverName,
    driver_phone: normalized.driverPhone,
    tracking_reference: normalized.trackingReference,
  };
  const identityIds = await ids("dispatch-proof", [normalized.orderId,transportSnapshot,evidenceReferences,normalized.dispatchedAt,normalized.actorId]);
  const { data, error } = await supabase.rpc("record_dispatch_proof_packet_v1", {
    p_order_id: normalized.orderId, p_transport_snapshot: transportSnapshot,
    p_evidence_references: evidenceReferences, p_dispatched_at: normalized.dispatchedAt,
    p_correlation_id: identityIds.correlationId, p_idempotency_key: identityIds.idempotencyKey, p_actor_id: normalized.actorId,
  });
  return row(governed(data, error, "recordDispatchProof"), "recordDispatchProof");
}
