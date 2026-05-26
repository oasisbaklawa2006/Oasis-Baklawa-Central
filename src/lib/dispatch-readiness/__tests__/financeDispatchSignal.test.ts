import { describe, expect, it } from "vitest";
import {
  financeSignalLabel,
  isFinanceSignalBlocking,
  isFinanceSignalReady,
  observeFinanceDispatchSignal,
  resolveDispatchFinanceSignal,
} from "../financeDispatchSignal";
import type { FinanceGovernanceInput } from "@/lib/finance-governance/financeGovernanceTypes";

describe("financeDispatchSignal", () => {
  it("is read-only observe helper", () => {
    const o = observeFinanceDispatchSignal("order-1", "pending_review");
    expect(o.signal).toBe("pending_review");
  });

  it("ready only when signal is ready", () => {
    expect(isFinanceSignalReady("ready")).toBe(true);
    expect(isFinanceSignalReady("unknown")).toBe(false);
  });

  it("blocked when signal blocked", () => {
    expect(isFinanceSignalBlocking("blocked")).toBe(true);
  });

  it("resolves from governance input", () => {
    const input: FinanceGovernanceInput = {
      orderId: "o1",
      orderValue: 50_000,
      advanceRequired: 10_000,
      advanceVerified: true,
      creditApproved: true,
      openHoldTypes: [],
      reservationReady: true,
      dispatchReadinessGateEligible: true,
      complaintSeverity: "none",
      staleFinanceReview: false,
      manualOverrideCount: 0,
      rejectionCount: 0,
      escalationCount: 0,
    };
    expect(resolveDispatchFinanceSignal(input)).toBe("ready");
    expect(financeSignalLabel("ready")).not.toMatch(/capture|invoice/i);
  });

  it("falls back when no governance input", () => {
    expect(resolveDispatchFinanceSignal(null, "unknown")).toBe("unknown");
  });
});
