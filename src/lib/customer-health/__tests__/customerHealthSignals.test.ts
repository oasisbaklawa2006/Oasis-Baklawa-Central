import { describe, expect, it } from "vitest";
import { extractCustomerHealthSignals } from "../customerHealthSignals";
import type { CustomerHealthProjectionInput } from "../customerHealthTypes";

const NOW = "2026-09-06T08:00:00.000Z";

describe("extractCustomerHealthSignals", () => {
  it("marks overdue CRM tasks with authoritative provenance", () => {
    const input: CustomerHealthProjectionInput = {
      companyId: "a1b2c3d4-e5f6-4789-a012-3456789abcde",
      profile: {
        totalOutstanding: 0,
        creditLimit: null,
        allowCredit: true,
        currentBalance: 0,
        observedAt: NOW,
      },
      orders: [],
      tasks: [{ id: "task-1", status: "open", dueDate: "2026-09-01" }],
      tickets: [],
      communications: [],
      upstreamErrors: [],
    };

    const { available } = extractCustomerHealthSignals(input, NOW);
    const overdue = available.find((s) => s.signalId === "overdue_crm_tasks");
    expect(overdue?.contributesToRisk).toBe(true);
    expect(overdue?.sourceAuthority).toBe("crm_tasks");
  });

  it("detects fulfilment hold orders", () => {
    const input: CustomerHealthProjectionInput = {
      companyId: "a1b2c3d4-e5f6-4789-a012-3456789abcde",
      profile: {
        totalOutstanding: 0,
        creditLimit: null,
        allowCredit: true,
        currentBalance: 0,
        observedAt: NOW,
      },
      orders: [{ orderId: "o1", status: "finance_hold", createdAt: NOW }],
      tasks: [],
      tickets: [],
      communications: [],
      upstreamErrors: [],
    };

    const { available } = extractCustomerHealthSignals(input, NOW);
    expect(available.find((s) => s.signalId === "stuck_order_fulfilment")?.contributesToRisk).toBe(true);
  });
});
