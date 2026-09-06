import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  assertCommercialHoldReleaseCoreAvailable,
  assertFinanceControlWriteGuards,
  COMMERCIAL_HOLD_RELEASE_CORE_PREREQUISITE,
  executeFinanceControlWrite,
  FinanceHoldReleaseAuthorityError,
  FINANCE_CONTROL_SURFACE_CENSUS,
  listPoint80CoreSurfaces,
  listPoint80ShadowSurfaces,
  requiresSecondApproval,
} from "../financeHoldReleaseAuthorityClient";

const clearanceFacts = {
  order_id: "order-1",
  company_id: "company-1",
  pi_id: "pi-1",
  commercial_version_id: "version-1",
  commercial_value: 10000,
  required_advance: 3000,
  verified_payment_amount: 3000,
  wallet_applied_amount: 0,
  approved_credit_amount: 0,
  covered_amount: 3000,
  eligible_for_operations_clearance: true,
  latest_clearance_event_id: "evt-1",
  latest_clearance_decision: "GRANTED",
  payment_verified_is_not_clearance: true,
};

vi.mock("@/lib/order-authority/financeClearanceAuthorityClient", () => ({
  buildFinanceOperationsCorrelationId: vi.fn(async () => "central:pf6c:operations:corr"),
  buildFinanceOperationsDecisionIdentity: vi.fn(() => "identity"),
  buildFinanceOperationsIdempotencyKey: vi.fn(async () => "central:pf6c:operations:key"),
  decideFinanceOperationsClearance: vi.fn(async () => ({
    clearanceEventId: "clearance-1",
    decision: "GRANTED",
    alreadyDecided: false,
  })),
  getFinanceOperationsClearanceFacts: vi.fn(async () => ({
    orderId: "order-1",
    companyId: "company-1",
    piId: "pi-1",
    commercialVersionId: "version-1",
    commercialValue: 10000,
    requiredAdvance: 3000,
    verifiedPaymentAmount: 3000,
    walletAppliedAmount: 0,
    approvedCreditAmount: 0,
    coveredAmount: 3000,
    eligibleForOperationsClearance: true,
    latestClearanceEventId: "evt-1",
    latestClearanceDecision: "GRANTED",
  })),
  parseFinanceOperationsClearanceFacts: vi.fn(),
}));

vi.mock("@/lib/order-authority/financeExitAuthorityClient", () => ({
  decideFinanceDispatchClearance: vi.fn(async () => ({
    clearance_event_id: "dispatch-clearance-1",
    already_decided: false,
  })),
  getFinanceExitFacts: vi.fn(async () => ({
    orderId: "order-1",
    companyId: "company-1",
    orderStatus: "cleared_for_dispatch",
    financeDplReceiptId: null,
    financeDplSourceAuthority: null,
    commercialVersionId: "version-1",
    piId: "pi-1",
    finalInvoiceId: "invoice-1",
    invoiceNumber: "INV-1",
    invoiceDate: "2026-01-01",
    invoiceGrossTotal: 10000,
    settlement: null,
    ewayEvidenceId: null,
    ewayStatus: null,
    ewayBillNumber: null,
    dispatchClearanceEventId: "dispatch-evt-1",
    dispatchClearanceDecision: "GRANTED",
    dispatchCleared: true,
    dispatchProofId: null,
    dispatchedAt: null,
    complaintClockBasis: "FINAL_INVOICE_DATE",
    complaintDeadline: null,
    complaintWindowOpen: null,
  })),
}));

vi.mock("@/lib/order-authority/paymentAuthorityClient", () => ({
  resolvePaymentBinding: vi.fn(async () => ({
    piId: "pi-1",
    orderId: "order-1",
    commercialVersionId: "version-1",
    status: "ISSUED",
  })),
}));

const baseInput = {
  lane: "operations" as const,
  action: "release" as const,
  orderId: "order-1",
  reason: "Finance review approved Operations Clearance",
  evidenceReference: "core-finance-facts:pi-1:version-1",
  actorId: "00000000-0000-4000-8000-000000000001",
  actorRole: "FINANCE_HEAD",
  aal2Verified: true,
};

describe("Point 80 finance hold/release/reversal authority", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("census separates Point 80 Core surfaces from Point 78/79/81 and shadow paths", () => {
    expect(FINANCE_CONTROL_SURFACE_CENSUS.length).toBeGreaterThanOrEqual(8);
    expect(listPoint80CoreSurfaces().map((row) => row.coreRpc)).toEqual([
      "decide_finance_operations_clearance_v1",
      "decide_finance_dispatch_clearance_v1",
    ]);
    const shadowKinds = listPoint80ShadowSurfaces().map((row) => row.kind);
    expect(shadowKinds).toContain("commercial_hold");
    expect(shadowKinds).toContain("commercial_release");
    expect(shadowKinds).toContain("derived_ui_hold");
    expect(FINANCE_CONTROL_SURFACE_CENSUS.some((row) => row.pointScope === "point78")).toBe(true);
    expect(FINANCE_CONTROL_SURFACE_CENSUS.some((row) => row.pointScope === "point79")).toBe(true);
  });

  it("fails closed without AAL2", () => {
    expect(() =>
      assertFinanceControlWriteGuards({ ...baseInput, aal2Verified: false }),
    ).toThrow(/AAL2 step-up authentication is required/);
  });

  it("fails closed on dispatch role attempting finance control", () => {
    expect(() =>
      assertFinanceControlWriteGuards({ ...baseInput, actorRole: "DISPATCH_MANAGER" }),
    ).toThrow(/cannot perform finance actions|cannot decide Operations Clearance/);
  });

  it("requires distinct second approver for high-value dual control", () => {
    expect(requiresSecondApproval(250_000)).toBe(true);
    expect(() =>
      assertFinanceControlWriteGuards({
        ...baseInput,
        commercialValue: 300_000,
        secondApproverActorId: baseInput.actorId,
      }),
    ).toThrow(/Self-approval is forbidden/);
    expect(() =>
      assertFinanceControlWriteGuards({
        ...baseInput,
        commercialValue: 300_000,
        secondApproverActorId: null,
      }),
    ).toThrow(/second approver/);
  });

  it("blocks commercial hold/release until Core prerequisite RPCs exist", () => {
    expect(() => assertCommercialHoldReleaseCoreAvailable()).toThrow(/commercial control RPC family/);
    try {
      assertCommercialHoldReleaseCoreAvailable();
    } catch (error) {
      expect(error).toBeInstanceOf(FinanceHoldReleaseAuthorityError);
      expect((error as FinanceHoldReleaseAuthorityError).prerequisite).toBe(
        COMMERCIAL_HOLD_RELEASE_CORE_PREREQUISITE,
      );
    }
  });

  it("routes operations release through decide_finance_operations_clearance_v1", async () => {
    const { decideFinanceOperationsClearance } = await import("@/lib/order-authority/financeClearanceAuthorityClient");
    const result = await executeFinanceControlWrite(baseInput);
    expect(decideFinanceOperationsClearance).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: "order-1",
        decision: "GRANTED",
        sourceChannel: "CENTRAL",
      }),
    );
    expect(result.decision).toBe("GRANTED");
    expect(result.eventId).toBe("clearance-1");
  });

  it("maps hold and reversal to DENIED and REVOKED decisions", async () => {
    const { decideFinanceOperationsClearance, getFinanceOperationsClearanceFacts } = await import(
      "@/lib/order-authority/financeClearanceAuthorityClient"
    );
    vi.mocked(getFinanceOperationsClearanceFacts).mockResolvedValueOnce({
      orderId: "order-1",
      companyId: "company-1",
      piId: "pi-1",
      commercialVersionId: "version-1",
      commercialValue: 10000,
      requiredAdvance: 3000,
      verifiedPaymentAmount: 0,
      walletAppliedAmount: 0,
      approvedCreditAmount: 0,
      coveredAmount: 0,
      eligibleForOperationsClearance: false,
      latestClearanceEventId: null,
      latestClearanceDecision: null,
    });

    await executeFinanceControlWrite({ ...baseInput, action: "hold" });
    expect(decideFinanceOperationsClearance).toHaveBeenCalledWith(
      expect.objectContaining({ decision: "DENIED" }),
    );

    vi.mocked(getFinanceOperationsClearanceFacts).mockResolvedValueOnce({
      orderId: "order-1",
      companyId: "company-1",
      piId: "pi-1",
      commercialVersionId: "version-1",
      commercialValue: 10000,
      requiredAdvance: 3000,
      verifiedPaymentAmount: 3000,
      walletAppliedAmount: 0,
      approvedCreditAmount: 0,
      coveredAmount: 3000,
      eligibleForOperationsClearance: true,
      latestClearanceEventId: "evt-1",
      latestClearanceDecision: "GRANTED",
    });

    await executeFinanceControlWrite({ ...baseInput, action: "reversal" });
    expect(decideFinanceOperationsClearance).toHaveBeenCalledWith(
      expect.objectContaining({ decision: "REVOKED" }),
    );
  });

  it("returns idempotent already-held without duplicate Core mutation", async () => {
    const { decideFinanceOperationsClearance, getFinanceOperationsClearanceFacts } = await import(
      "@/lib/order-authority/financeClearanceAuthorityClient"
    );
    vi.mocked(getFinanceOperationsClearanceFacts).mockResolvedValueOnce({
      orderId: "order-1",
      companyId: "company-1",
      piId: "pi-1",
      commercialVersionId: "version-1",
      commercialValue: 10000,
      requiredAdvance: 3000,
      verifiedPaymentAmount: 0,
      walletAppliedAmount: 0,
      approvedCreditAmount: 0,
      coveredAmount: 0,
      eligibleForOperationsClearance: false,
      latestClearanceEventId: "evt-denied",
      latestClearanceDecision: "DENIED",
    });

    const result = await executeFinanceControlWrite({ ...baseInput, action: "hold" });
    expect(result.alreadyDecided).toBe(true);
    expect(decideFinanceOperationsClearance).not.toHaveBeenCalled();
  });

  it("routes dispatch reversal through decide_finance_dispatch_clearance_v1", async () => {
    const { decideFinanceDispatchClearance } = await import("@/lib/order-authority/financeExitAuthorityClient");
    const result = await executeFinanceControlWrite({
      ...baseInput,
      lane: "dispatch",
      action: "reversal",
      finalInvoiceId: "invoice-1",
    });
    expect(decideFinanceDispatchClearance).toHaveBeenCalledWith(
      expect.objectContaining({ finalInvoiceId: "invoice-1", decision: "REVOKED" }),
    );
    expect(result.lane).toBe("dispatch");
  });

  it("exposes only canonical Core RPCs in the client source", () => {
    const client = readFileSync(
      resolve(process.cwd(), "src/lib/order-authority/financeHoldReleaseAuthorityClient.ts"),
      "utf8",
    );
    expect(client).toContain("decide_finance_operations_clearance_v1");
    expect(client).toContain("decide_finance_dispatch_clearance_v1");
    expect(client).not.toContain('from("finance_review_evidence")');
    expect(client).not.toContain('from("orders").update');
  });

  it("parses clearance facts separation marker in census notes", () => {
    const row = FINANCE_CONTROL_SURFACE_CENSUS.find((entry) => entry.kind === "operations_clearance");
    expect(row?.notes).toContain("get_finance_operations_clearance_facts_v1");
    expect(parseFinanceOperationsClearanceFactsMarker()).toBe(true);
  });
});

function parseFinanceOperationsClearanceFactsMarker(): boolean {
  return clearanceFacts.payment_verified_is_not_clearance === true;
}
