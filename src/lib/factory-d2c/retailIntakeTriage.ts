/**
 * FACT-D2C-01: read-only retail-to-factory planning harness.
 *
 * This is NOT a Core RPC, order acceptance decision, payment verification,
 * stock reservation, factory job creation, priority override, or dispatch
 * release. Do not wire this into operational mutations. All evidence fields
 * must eventually come from a server-authoritative Core projection.
 *
 * B2B journeys and existing P&A / Dispatch authorities remain unchanged.
 */

export type RetailDemandPath =
  | "READY_STOCK_PACK"
  | "PNA_ASSEMBLY"
  | "PRODUCTION_DEPENDENCY"
  | "UNKNOWN";

export type RetailIntakeSnapshot = Readonly<{
  source: "D2C_RETAIL";
  retailOrderId: string;
  orderVersion: number;
  commercialState: "ACCEPTED" | "PENDING" | "CANCELLED";
  paymentState: "VERIFIED_PREPAID" | "COD_REQUESTED" | "PENDING" | "FAILED";
  /** Server-attested payment event reference, never a browser 'paid' flag. */
  corePaymentEvidenceRef?: string | null;
  /** Server-attested stock/BOM/fulfilment decision, not a UI estimate. */
  corePlanningEvidenceRef?: string | null;
  demandPath: RetailDemandPath;
  /** An already-computed, server-backed dispatch SLA state. */
  dispatchSla: "ON_TRACK" | "AT_RISK" | "UNKNOWN";
  coreSlaEvidenceRef?: string | null;
}>;

export type RetailFactoryLane =
  | "RETAIL_PICK_PACK"
  | "PACKING_ASSEMBLY"
  | "PRODUCTION_SHORTAGE_TO_PNA";

export type RetailIntakeTriage =
  | Readonly<{
      disposition: "HOLD";
      reason:
        | "MISSING_ORDER_IDENTITY"
        | "ORDER_NOT_ACCEPTED"
        | "COD_POLICY_NOT_APPROVED"
        | "PAYMENT_NOT_VERIFIED"
        | "MISSING_PAYMENT_EVIDENCE"
        | "MISSING_FACTORY_PLANNING_EVIDENCE"
        | "DEMAND_NOT_CLASSIFIED";
      suggestedLane: null;
      urgency: "NORMAL";
      authority: "READ_ONLY";
    }>
  | Readonly<{
      disposition: "PLANNING_CANDIDATE_ONLY";
      reason: "EVIDENCE_PRESENT_NOT_AUTHORIZATION";
      suggestedLane: RetailFactoryLane;
      urgency: "NORMAL" | "SLA_AT_RISK";
      authority: "READ_ONLY";
    }>;

const hasRef = (value: string | null | undefined): boolean =>
  typeof value === "string" && value.trim().length > 0;

const hold = (reason: Extract<RetailIntakeTriage, { disposition: "HOLD" }>["reason"]): RetailIntakeTriage => ({
  disposition: "HOLD",
  reason,
  suggestedLane: null,
  urgency: "NORMAL",
  authority: "READ_ONLY",
});

/**
 * Planning-only, fail-closed classification.
 *
 * Even PLANNING_CANDIDATE_ONLY does not allow Core order release, production
 * creation, stock issue, P&A job creation, courier booking, or gate exit.
 * Core must independently enforce every mutation and commercial policy.
 */
export function triageRetailFactoryIntake(snapshot: RetailIntakeSnapshot): RetailIntakeTriage {
  if (!hasRef(snapshot.retailOrderId) || !Number.isSafeInteger(snapshot.orderVersion) || snapshot.orderVersion < 1) {
    return hold("MISSING_ORDER_IDENTITY");
  }
  if (snapshot.commercialState !== "ACCEPTED") return hold("ORDER_NOT_ACCEPTED");

  // COD is not an approved launch mode. A frontend flag must never override
  // pending owner policy on COD acceptance/collection/reconciliation.
  if (snapshot.paymentState === "COD_REQUESTED") return hold("COD_POLICY_NOT_APPROVED");
  if (snapshot.paymentState !== "VERIFIED_PREPAID") return hold("PAYMENT_NOT_VERIFIED");
  if (!hasRef(snapshot.corePaymentEvidenceRef)) return hold("MISSING_PAYMENT_EVIDENCE");

  // The current retail checkout contract records a reservation window but
  // does not decrement/reserve actual stock. An unproven planning decision
  // must never send goods to a floor queue.
  if (!hasRef(snapshot.corePlanningEvidenceRef)) return hold("MISSING_FACTORY_PLANNING_EVIDENCE");

  const lane: RetailFactoryLane | null =
    snapshot.demandPath === "READY_STOCK_PACK" ? "RETAIL_PICK_PACK"
      : snapshot.demandPath === "PNA_ASSEMBLY" ? "PACKING_ASSEMBLY"
        : snapshot.demandPath === "PRODUCTION_DEPENDENCY" ? "PRODUCTION_SHORTAGE_TO_PNA"
          : null;

  if (!lane) return hold("DEMAND_NOT_CLASSIFIED");

  return {
    disposition: "PLANNING_CANDIDATE_ONLY",
    reason: "EVIDENCE_PRESENT_NOT_AUTHORIZATION",
    suggestedLane: lane,
    // A D2C label never automatically raises priority over a B2B order.
    urgency: snapshot.dispatchSla === "AT_RISK" && hasRef(snapshot.coreSlaEvidenceRef)
      ? "SLA_AT_RISK"
      : "NORMAL",
    authority: "READ_ONLY",
  };
}
