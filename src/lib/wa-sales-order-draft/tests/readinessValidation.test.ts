import { describe, expect, it } from "vitest";
import {
  canTransitionToApproved,
  validateSalesOrderSoRecordableReadiness,
} from "../readinessValidation";
import type { DraftOrderReadinessDimension } from "@/lib/wa-governance/draftOrderExtractionTypes";

const baseDimensions: DraftOrderReadinessDimension[] = [
  { dimension: "client", score: 100, status: "ready", explanation: "" },
  { dimension: "product", score: 100, status: "ready", explanation: "" },
  { dimension: "quantity", score: 100, status: "ready", explanation: "" },
  {
    dimension: "address",
    score: 0,
    status: "pending",
    explanation: "Dispatch destination pending",
    gate: "DISPATCH_READY",
    hold_code: "DELIVERY_DETAILS_PENDING",
  },
  {
    dimension: "payment_terms",
    score: 0,
    status: "pending",
    explanation: "Billing details pending",
    gate: "BILLING_READY",
    hold_code: "BILLING_DETAILS_PENDING",
  },
];

describe("SO_RECORDABLE readiness (MC#631)", () => {
  it("allows approval when only downstream dimensions are pending", () => {
    expect(validateSalesOrderSoRecordableReadiness(baseDimensions).valid).toBe(true);
    expect(canTransitionToApproved(baseDimensions).valid).toBe(true);
  });

  it("blocks when core SO dimensions are missing", () => {
    const broken = baseDimensions.map((d) =>
      d.dimension === "product" ? { ...d, status: "missing" as const, score: 0 } : d,
    );
    expect(canTransitionToApproved(broken).valid).toBe(false);
  });

  it("blocks approval when downstream dimensions are absent from the array", () => {
    const coreOnly = baseDimensions.filter(
      (d) => d.dimension !== "address" && d.dimension !== "payment_terms",
    );
    const result = canTransitionToApproved(coreOnly);
    expect(result.valid).toBe(false);
    expect(result.messages.some((m) => m.includes("address"))).toBe(true);
    expect(result.messages.some((m) => m.includes("payment_terms"))).toBe(true);
  });

  it("blocks when downstream dimensions are missing status rather than pending", () => {
    const withMissingAddress = baseDimensions.map((d) =>
      d.dimension === "address" ? { ...d, status: "missing" as const, score: 0 } : d,
    );
    expect(canTransitionToApproved(withMissingAddress).valid).toBe(false);
  });

  it("blocks when downstream dimension is missing even with a high score", () => {
    const withScoredMissingPayment = baseDimensions.map((d) =>
      d.dimension === "payment_terms"
        ? { ...d, status: "missing" as const, score: 100 }
        : d,
    );
    expect(canTransitionToApproved(withScoredMissingPayment).valid).toBe(false);
  });
});
