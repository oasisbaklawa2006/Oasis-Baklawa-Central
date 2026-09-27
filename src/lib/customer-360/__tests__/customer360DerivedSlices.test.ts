import { describe, expect, it } from "vitest";
import {
  buildCustomerHealthReadModel,
  buildFinanceExposureFromProfile,
} from "../customer360DerivedSlices";
import type {
  Customer360CompanyProfile,
  Customer360InteractionSummary,
  Customer360TaskSummary,
} from "../customer360Types";

const profile: Customer360CompanyProfile = {
  companyId: "a1b2c3d4-e5f6-4789-a012-3456789abcde",
  businessName: "Acme Sweets",
  status: "approved",
  phone: null,
  registeredAddress: null,
  gstNumber: null,
  accountManagerId: "exec-1",
  allowCredit: true,
  creditLimit: 100000,
  walletBalance: 5000,
  currentBalance: 12000,
  totalOutstanding: 90000,
  discountPercentage: null,
  paymentTerms: "NET30",
  priceTier: null,
  createdAt: null,
};

describe("customer360DerivedSlices", () => {
  it("builds factual finance exposure without invented ageing", () => {
    const exposure = buildFinanceExposureFromProfile(profile);
    expect(exposure.totalOutstanding).toBe(90000);
    expect(exposure.creditHeadroom).toBe(10000);
    expect(exposure.paymentTerms).toBe("NET30");
  });

  it("derives health signals and next-best-actions from CRM facts", () => {
    const tasks: Customer360TaskSummary[] = [
      {
        id: "task-1",
        taskType: "follow_up",
        status: "pending",
        dueDate: "2020-01-01",
        description: "Overdue follow-up",
        createdAt: null,
      },
    ];
    const interactions: Customer360InteractionSummary[] = [
      {
        id: "ci-1",
        interactionType: "call",
        notes: "Check-in",
        outcome: null,
        followUpDate: "2020-01-01",
        createdAt: "2020-01-01T00:00:00.000Z",
      },
    ];

    const health = buildCustomerHealthReadModel(profile, tasks, interactions, Date.parse("2026-03-01T00:00:00.000Z"));
    expect(health.overdueTaskCount).toBe(1);
    expect(health.creditUtilizationPercent).toBe(90);
    expect(health.signals.some((signal) => signal.signal === "overdue_tasks")).toBe(true);
    expect(health.signals.some((signal) => signal.signal === "high_credit_utilization")).toBe(true);
    expect(health.nextBestActions[0]?.action).toContain("overdue CRM tasks");
  });
});
