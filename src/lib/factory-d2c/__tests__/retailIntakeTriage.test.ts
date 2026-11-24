import { describe, expect, it } from "vitest";
import {
  triageRetailFactoryIntake,
  type RetailIntakeSnapshot,
} from "../retailIntakeTriage";

const verified = (overrides: Partial<RetailIntakeSnapshot> = {}): RetailIntakeSnapshot => ({
  source: "D2C_RETAIL",
  retailOrderId: "retail-fixture-001",
  orderVersion: 1,
  commercialState: "ACCEPTED",
  paymentState: "VERIFIED_PREPAID",
  corePaymentEvidenceRef: "core-payment-evidence-fixture",
  corePlanningEvidenceRef: "core-stock-or-bom-fixture",
  demandPath: "PNA_ASSEMBLY",
  dispatchSla: "ON_TRACK",
  coreSlaEvidenceRef: "core-dispatch-sla-fixture",
  ...overrides,
});

describe("FACT-D2C-01 retail factory intake design harness (read only)", () => {
  it("T01 proposes P&A for a verified prepaid gift, without authorizing execution", () => {
    expect(triageRetailFactoryIntake(verified())).toEqual({
      disposition: "PLANNING_CANDIDATE_ONLY",
      reason: "EVIDENCE_PRESENT_NOT_AUTHORIZATION",
      suggestedLane: "PACKING_ASSEMBLY",
      urgency: "NORMAL",
      authority: "READ_ONLY",
    });
  });

  it("T02 proposes a production dependency, never a B2B wholesale RGS fulfilment lane", () => {
    expect(triageRetailFactoryIntake(verified({ demandPath: "PRODUCTION_DEPENDENCY" })).suggestedLane)
      .toBe("PRODUCTION_SHORTAGE_TO_PNA");
  });

  it("T03 proposes retail pick/pack for already accepted ready stock", () => {
    expect(triageRetailFactoryIntake(verified({ demandPath: "READY_STOCK_PACK" })).suggestedLane)
      .toBe("RETAIL_PICK_PACK");
  });

  it("T04 holds COD while its business policy is undecided, even with fake payment evidence", () => {
    expect(triageRetailFactoryIntake(verified({
      paymentState: "COD_REQUESTED",
      corePaymentEvidenceRef: "claimed-COD-paid",
    }))).toMatchObject({
      disposition: "HOLD",
      reason: "COD_POLICY_NOT_APPROVED",
      suggestedLane: null,
    });
  });

  it.each(["PENDING", "FAILED"] as const)("T05 holds %s payment rather than treating an order as paid", (paymentState) => {
    expect(triageRetailFactoryIntake(verified({ paymentState })).reason)
      .toBe("PAYMENT_NOT_VERIFIED");
  });

  it("T05 also refuses a paid label without an independently attested payment reference", () => {
    expect(triageRetailFactoryIntake(verified({ corePaymentEvidenceRef: "  " })).reason)
      .toBe("MISSING_PAYMENT_EVIDENCE");
  });

  it("T06 classifies an identical replay deterministically; it creates no jobs/events", () => {
    const snapshot = verified({ retailOrderId: "retail-fixture-replayed" });
    expect(triageRetailFactoryIntake(snapshot)).toEqual(triageRetailFactoryIntake(snapshot));
    expect(triageRetailFactoryIntake(snapshot).authority).toBe("READ_ONLY");
  });

  it("T07 holds orders that are not accepted, including cancellations", () => {
    for (const commercialState of ["PENDING", "CANCELLED"] as const) {
      expect(triageRetailFactoryIntake(verified({ commercialState })).reason)
        .toBe("ORDER_NOT_ACCEPTED");
    }
  });

  it("T08 does not make retail urgent merely for being retail", () => {
    expect(triageRetailFactoryIntake(verified({ dispatchSla: "ON_TRACK" })).urgency)
      .toBe("NORMAL");
    expect(triageRetailFactoryIntake(verified({
      dispatchSla: "AT_RISK",
      coreSlaEvidenceRef: null,
    })).urgency).toBe("NORMAL");
    expect(triageRetailFactoryIntake(verified({ dispatchSla: "AT_RISK" })).urgency)
      .toBe("SLA_AT_RISK");
  });

  it("T09 refuses malformed source identity/version to avoid cross-order confusion", () => {
    expect(triageRetailFactoryIntake(verified({ retailOrderId: "" })).reason)
      .toBe("MISSING_ORDER_IDENTITY");
    expect(triageRetailFactoryIntake(verified({ orderVersion: 0 })).reason)
      .toBe("MISSING_ORDER_IDENTITY");
  });

  it("T10 holds if no Core planning/stock evidence exists, or demand is unclassified", () => {
    expect(triageRetailFactoryIntake(verified({ corePlanningEvidenceRef: undefined })).reason)
      .toBe("MISSING_FACTORY_PLANNING_EVIDENCE");
    expect(triageRetailFactoryIntake(verified({ demandPath: "UNKNOWN" })).reason)
      .toBe("DEMAND_NOT_CLASSIFIED");
  });
});
