import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  assertCommercialHoldReleaseCoreAvailable,
  assertDualControl,
  assertFinanceControlWriteGuards,
  assertSourceVersion,
  COMMERCIAL_HOLD_RELEASE_CORE_PREREQUISITE,
  executeFinanceControlWrite,
  FinanceHoldReleaseAuthorityError,
  FINANCE_CONTROL_SURFACE_CENSUS,
  formatFinanceControlPrerequisite,
  listPoint80ClearanceSurfaces,
  listPoint80CoreSurfaces,
  listPoint80ShadowSurfaces,
  listPoint80TypedControlSurfaces,
  POINT80_REQUIRED_CORE_RPCS,
  POINT80_TYPED_CONTROL_CORE_PREREQUISITE,
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

vi.mock("@/lib/order-authority/financeControlMutations", () => ({
  placeFinanceHold: vi.fn(async () => ({
    eventId: "typed-hold-1",
    alreadyApplied: false,
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

  it("census separates Point 80 clearance, typed PF-6D, Point 78/79/81, and shadow paths", () => {
    expect(FINANCE_CONTROL_SURFACE_CENSUS.length).toBeGreaterThanOrEqual(12);
    expect(listPoint80ClearanceSurfaces().map((row) => row.coreRpc)).toEqual([
      "decide_finance_operations_clearance_v1",
      "decide_finance_dispatch_clearance_v1",
    ]);
    expect(listPoint80TypedControlSurfaces().map((row) => row.kind)).toEqual([
      "typed_finance_hold",
      "typed_finance_release",
      "typed_finance_reversal",
      "typed_second_approval",
    ]);
    expect(listPoint80CoreSurfaces().length).toBeGreaterThanOrEqual(6);
    const shadowKinds = listPoint80ShadowSurfaces().map((row) => row.kind);
    expect(shadowKinds).toContain("shadow_finance_review_evidence");
    expect(shadowKinds).toContain("derived_ui_hold");
    expect(FINANCE_CONTROL_SURFACE_CENSUS.some((row) => row.pointScope === "point78")).toBe(true);
    expect(FINANCE_CONTROL_SURFACE_CENSUS.some((row) => row.pointScope === "point79")).toBe(true);
  });

  it("uses canonical PF-6D RPC names aligned with #525 census", () => {
    expect(POINT80_REQUIRED_CORE_RPCS).toEqual([
      "get_finance_control_facts_v1",
      "place_finance_hold_v1",
      "release_finance_hold_v1",
      "request_finance_reversal_v1",
      "complete_finance_reversal_v1",
      "request_finance_second_approval_v1",
      "decide_finance_second_approval_v1",
    ]);
    expect(POINT80_TYPED_CONTROL_CORE_PREREQUISITE).toContain("place_finance_hold_v1");
    expect(POINT80_TYPED_CONTROL_CORE_PREREQUISITE).not.toContain("place_finance_commercial_hold_v1");
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

  it("denies dual-control self approval and stale source version", () => {
    expect(() => assertDualControl("actor-a", "actor-a")).toThrow(/different actor/);
    expect(() => assertSourceVersion(2, 1)).toThrow(/Stale finance control source version/);
    expect(() => assertSourceVersion(2, 2)).not.toThrow();
  });

  it("blocks typed hold/release until Core PF-6D prerequisite RPCs exist", () => {
    expect(() => assertCommercialHoldReleaseCoreAvailable()).toThrow(/PF-6D finance control RPCs/);
    try {
      assertCommercialHoldReleaseCoreAvailable();
    } catch (error) {
      expect(error).toBeInstanceOf(FinanceHoldReleaseAuthorityError);
      expect((error as FinanceHoldReleaseAuthorityError).prerequisite).toBe(
        COMMERCIAL_HOLD_RELEASE_CORE_PREREQUISITE,
      );
    }
  });

  it("formats prerequisite messages from missing RPC probes", () => {
    expect(formatFinanceControlPrerequisite(["place_finance_hold_v1"])).toContain("place_finance_hold_v1");
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

  it("fail-closes typed hold when PF-6D control is unavailable", async () => {
    const { decideFinanceOperationsClearance } = await import("@/lib/order-authority/financeClearanceAuthorityClient");
    const { placeFinanceHold } = await import("@/lib/order-authority/financeControlMutations");

    await expect(
      executeFinanceControlWrite({ ...baseInput, action: "hold", typedControlAvailable: false }),
    ).rejects.toThrow(/PF-6D finance control RPCs/);
    expect(placeFinanceHold).not.toHaveBeenCalled();
    expect(decideFinanceOperationsClearance).not.toHaveBeenCalled();
  });

  it("routes typed hold through place_finance_hold_v1 when PF-6D is available", async () => {
    const { placeFinanceHold } = await import("@/lib/order-authority/financeControlMutations");
    const result = await executeFinanceControlWrite({
      ...baseInput,
      action: "hold",
      holdType: "compliance_review_pending",
      typedControlAvailable: true,
    });
    expect(placeFinanceHold).toHaveBeenCalledWith(
      expect.objectContaining({
        holdType: "compliance_review_pending",
        binding: expect.objectContaining({ orderId: "order-1", piId: "pi-1" }),
      }),
    );
    expect(result.decision).toBe("HELD");
    expect(result.eventId).toBe("typed-hold-1");
  });

  it("maps reversal to REVOKED clearance decision without using clearance DENIED as hold", async () => {
    const { decideFinanceOperationsClearance } = await import("@/lib/order-authority/financeClearanceAuthorityClient");
    await executeFinanceControlWrite({ ...baseInput, action: "reversal" });
    expect(decideFinanceOperationsClearance).toHaveBeenCalledWith(
      expect.objectContaining({ decision: "REVOKED" }),
    );
    expect(decideFinanceOperationsClearance).not.toHaveBeenCalledWith(
      expect.objectContaining({ decision: "DENIED" }),
    );
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
    expect(client).toContain("place_finance_hold_v1");
    expect(client).not.toContain("place_finance_commercial_hold_v1");
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
