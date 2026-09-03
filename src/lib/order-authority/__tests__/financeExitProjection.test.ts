import { beforeEach, describe, expect, it, vi } from "vitest";

const { getFinanceExitFacts, getFinalPaymentPiFacts } = vi.hoisted(() => ({
  getFinanceExitFacts: vi.fn(),
  getFinalPaymentPiFacts: vi.fn(),
}));

vi.mock("@/lib/order-authority/financeExitAuthorityClient", () => ({
  getFinanceExitFacts,
}));

vi.mock("@/lib/order-authority/finalPaymentPiAuthorityClient", () => ({
  getFinalPaymentPiFacts,
}));

import {
  financeExitStage,
  loadGovernedFinanceExitProjection,
} from "@/lib/order-authority/financeExitProjection";

const baseFacts = {
  orderId: "order-1",
  companyId: "company-1",
  orderStatus: "packed_ready",
  financeDplReceiptId: "dpl-1",
  financeDplSourceAuthority: null,
  commercialVersionId: "cv-1",
  piId: "pi-1",
  finalInvoiceId: null,
  invoiceNumber: null,
  invoiceDate: null,
  invoiceGrossTotal: null,
  settlement: null,
  ewayEvidenceId: null,
  ewayStatus: null,
  ewayBillNumber: null,
  dispatchClearanceEventId: null,
  dispatchClearanceDecision: null,
  dispatchCleared: false,
  dispatchProofId: null,
  dispatchedAt: null,
  complaintClockBasis: null,
  complaintDeadline: null,
  complaintWindowOpen: null,
};

const baseFinalPaymentPi = {
  orderId: "order-1",
  available: true,
  finalPaymentRequestId: "req-1",
  piId: "pi-1",
  customerVisiblePiNumber: "PI2026/09-0001",
  revisionNumber: 1,
  effectiveStatus: "PAYMENT_DUE",
  financeDplReceiptId: "dpl-1",
  commercialVersionId: "cv-1",
  dplFingerprint: null,
  currency: "INR",
  taxableTotal: 10000,
  taxTotal: 1800,
  finalPayableTotal: 11800,
  verifiedPaymentTotal: 9000,
  walletAppliedTotal: 0,
  approvedCreditTotal: 0,
  creditedOrPaidTotal: 9000,
  balanceDue: 2800,
  settled: false,
  paymentAction: "BANK_TRANSFER" as const,
  paymentLink: null,
  paymentInstructions: "Transfer to governed account",
  documentReference: "storage:pi.pdf",
  reason: "Verified",
  sourceChannel: "CENTRAL",
  sourceReference: null,
  issuedAt: "2026-09-01T00:00:00.000Z",
  latestDelivery: null,
  factsAsOf: "2026-09-01T00:00:00.000Z",
  finalInvoiceMustNotRequestPayment: true,
};

beforeEach(() => {
  getFinanceExitFacts.mockReset();
  getFinalPaymentPiFacts.mockReset();
});

describe("financeExitStage", () => {
  it("reports final-invoice issuance when the PI revision is settled", () => {
    expect(
      financeExitStage(baseFacts, { ...baseFinalPaymentPi, settled: true, balanceDue: 0 }),
    ).toBe("Final payment settled — final invoice required");
  });

  it("reports settlement pending for an available unsettled PI", () => {
    expect(financeExitStage(baseFacts, baseFinalPaymentPi)).toBe(
      "Final-payment PI revision issued — settlement pending",
    );
  });

  it("reports PI revision required when DPL is received but no PI exists", () => {
    expect(financeExitStage(baseFacts, null)).toBe("Final-payment PI revision required");
  });
});

describe("loadGovernedFinanceExitProjection", () => {
  it("retains Finance Exit facts when the PI read fails", async () => {
    getFinanceExitFacts.mockResolvedValueOnce(baseFacts);
    getFinalPaymentPiFacts.mockRejectedValueOnce(new Error("PI unavailable"));

    const projection = await loadGovernedFinanceExitProjection("order-1");

    expect(projection.facts).toEqual(baseFacts);
    expect(projection.finalPaymentPi).toBeNull();
  });

  it("fails closed when Finance Exit facts are unavailable", async () => {
    getFinanceExitFacts.mockRejectedValueOnce(new Error("Finance Exit unavailable"));

    await expect(loadGovernedFinanceExitProjection("order-1")).rejects.toThrow("Finance Exit unavailable");
    expect(getFinalPaymentPiFacts).not.toHaveBeenCalled();
  });
});
