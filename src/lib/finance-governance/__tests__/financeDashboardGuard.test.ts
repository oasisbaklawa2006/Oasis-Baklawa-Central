import { describe, expect, it } from "vitest";
import { FORBIDDEN_FINANCE_ACTIONS } from "../financeGovernanceTypes";
import { FORBIDDEN_FINANCE_UI_LABELS } from "@/pages/admin/FinanceGovernanceBoard";

describe("finance dashboard guards", () => {
  it("lists forbidden finance actions", () => {
    expect(FORBIDDEN_FINANCE_ACTIONS).toContain("finance:capture_payment");
    expect(FORBIDDEN_FINANCE_ACTIONS).toContain("finance:generate_invoice");
  });

  it("UI excludes invoice and payment capture", () => {
    const labels = FORBIDDEN_FINANCE_UI_LABELS.join(" ");
    expect(labels).toMatch(/Invoice/);
    expect(labels).toMatch(/Capture Payment/);
    expect(labels).not.toMatch(/razorpay/i);
  });
});
