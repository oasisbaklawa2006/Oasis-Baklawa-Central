import { describe, expect, it } from "vitest";
import {
  canAdvancePackedReadyToClearedDispatch,
  getClearedForDispatchTransitionBlockers,
  getPackedReadyToClearedDispatchBlockers,
} from "@/utils/financeReleaseState";

const eligiblePackedReady = {
  status: "packed_ready",
  payment_status: "verified_advance",
  advance_paid: 50000,
  advance_required: 50000,
  sales_order_value: 100000,
};

describe("getPackedReadyToClearedDispatchBlockers (P0-AUTH-02)", () => {
  it("A — financially eligible packed_ready order has no blockers", () => {
    expect(getPackedReadyToClearedDispatchBlockers(eligiblePackedReady)).toEqual([]);
    expect(canAdvancePackedReadyToClearedDispatch(eligiblePackedReady)).toBe(true);
  });

  it("B — financially ineligible order cannot advance", () => {
    const ineligible = {
      ...eligiblePackedReady,
      payment_status: "awaiting_receipt",
      advance_paid: 0,
      advance_required: 50000,
    };
    const blockers = getPackedReadyToClearedDispatchBlockers(ineligible);
    expect(blockers.length).toBeGreaterThan(0);
    expect(canAdvancePackedReadyToClearedDispatch(ineligible)).toBe(false);
    expect(blockers.some((m) => /advance|finance/i.test(m))).toBe(true);
  });

  it("C — guard remains active when finance state stays ineligible (repeat evaluation)", () => {
    const ineligible = {
      ...eligiblePackedReady,
      payment_status: "awaiting_receipt",
      advance_paid: 10000,
      advance_required: 50000,
    };
    expect(canAdvancePackedReadyToClearedDispatch(ineligible)).toBe(false);
    expect(canAdvancePackedReadyToClearedDispatch(ineligible)).toBe(false);
    expect(getPackedReadyToClearedDispatchBlockers(ineligible).length).toBeGreaterThan(0);
  });

  it("D — missing payment status with positive order value fails closed", () => {
    const unknownPayment = {
      ...eligiblePackedReady,
      payment_status: null,
    };
    const blockers = getPackedReadyToClearedDispatchBlockers(unknownPayment);
    expect(blockers).toContain(
      "Payment status unknown — verify finance release before advancing to dispatch ready.",
    );
    expect(canAdvancePackedReadyToClearedDispatch(unknownPayment)).toBe(false);
  });

  it("rejects non-packed_ready status", () => {
    const blockers = getPackedReadyToClearedDispatchBlockers({
      ...eligiblePackedReady,
      status: "in_production",
    });
    expect(blockers).toContain("Order must be packed_ready before moving to dispatch ready.");
  });
});

describe("getClearedForDispatchTransitionBlockers (Order Management bypass)", () => {
  it("blocks awaiting_final_payment with finance hold", () => {
    const blockers = getClearedForDispatchTransitionBlockers({
      status: "awaiting_final_payment",
      payment_status: "awaiting_receipt",
      advance_paid: 10000,
      advance_required: 50000,
      sales_order_value: 100000,
    });
    expect(blockers.length).toBeGreaterThan(0);
  });

  it("allows awaiting_final_payment when finance cleared", () => {
    expect(
      getClearedForDispatchTransitionBlockers({
        status: "awaiting_final_payment",
        payment_status: "paid",
        advance_paid: 100000,
        advance_required: 50000,
        sales_order_value: 100000,
      }),
    ).toEqual([]);
  });
});
