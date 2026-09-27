import { describe, expect, it } from "vitest";
import {
  Point79WalletAuthorityError,
  normalizePaymentType,
  projectPaymentRow,
  toCanonicalPaymentFact,
} from "@/lib/point79WalletAuthority";

describe("point79WalletAuthority", () => {
  it("normalizes scalar payment_type values", () => {
    expect(normalizePaymentType("advance")).toBe("advance");
    expect(normalizePaymentType("balance")).toBe("balance");
  });

  it("normalizes single-element array payment_type projections", () => {
    expect(normalizePaymentType(["adjustment"])).toBe("adjustment");
  });

  it("rejects unsupported payment_type projections", () => {
    expect(() => normalizePaymentType(["advance", "balance"])).toThrow(Point79WalletAuthorityError);
    expect(() => normalizePaymentType("credit")).toThrow(Point79WalletAuthorityError);
  });

  it("projects canonical PaymentRow values", () => {
    const row = projectPaymentRow({
      payment_id: "payment-1",
      status: "uploaded",
      payment_type: ["advance"],
      submitted_amount: "2500",
      verified_amount: null,
      currency: "INR",
    });
    expect(row.paymentType).toBe("advance");
    expect(toCanonicalPaymentFact(row).paymentType).toBe("advance");
  });
});
