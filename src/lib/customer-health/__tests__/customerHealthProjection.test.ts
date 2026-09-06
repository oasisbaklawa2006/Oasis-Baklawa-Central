import { describe, expect, it } from "vitest";
import { buildCustomerHealthProjection } from "../customerHealthProjection";
import type { CustomerHealthProjectionInput } from "../customerHealthTypes";

const COMPANY_ID = "a1b2c3d4-e5f6-4789-a012-3456789abcde";
const NOW = "2026-09-06T08:00:00.000Z";

function baseInput(overrides: Partial<CustomerHealthProjectionInput> = {}): CustomerHealthProjectionInput {
  return {
    companyId: COMPANY_ID,
    profile: {
      totalOutstanding: 0,
      creditLimit: 100000,
      allowCredit: true,
      currentBalance: 0,
      observedAt: NOW,
    },
    orders: [],
    tasks: [],
    tickets: [],
    communications: [{ entryId: "comm-1", occurredAt: "2026-09-05T10:00:00.000Z" }],
    upstreamErrors: [],
    ...overrides,
  };
}

describe("buildCustomerHealthProjection", () => {
  it("projects healthy category when no risk signals fire", () => {
    const model = buildCustomerHealthProjection(baseInput(), NOW);
    expect(model.category).toBe("healthy");
    expect(model.confidence).toBeGreaterThan(0);
    expect(model.nextBestActions.some((a) => a.actionId === "maintain-relationship")).toBe(true);
  });

  it("elevates risk when open support tickets exist", () => {
    const model = buildCustomerHealthProjection(
      baseInput({
        tickets: [{ id: "t1", status: "open", issueType: "quality", createdAt: NOW }],
      }),
      NOW,
    );
    expect(["watch", "at_risk", "critical"]).toContain(model.category);
    expect(model.nextBestActions.some((a) => a.actionId === "review-open-tickets")).toBe(true);
  });

  it("flags credit utilization without inventing finance ageing", () => {
    const model = buildCustomerHealthProjection(
      baseInput({
        profile: {
          totalOutstanding: 95000,
          creditLimit: 100000,
          allowCredit: true,
          currentBalance: 0,
          observedAt: NOW,
        },
      }),
      NOW,
    );
    const commercial = model.riskDimensions.find((d) => d.dimensionId === "commercial_exposure");
    expect(commercial?.contributingFacts.some((f) => f.signalId === "credit_limit_utilization")).toBe(true);
    expect(model.unavailableSignals.some((s) => s.signalId === "finance_ageing_exposure")).toBe(true);
    expect(model.nextBestActions.some((a) => a.capability === "POINT77_finance_review")).toBe(true);
  });

  it("detects stale communication recency", () => {
    const model = buildCustomerHealthProjection(
      baseInput({
        communications: [{ entryId: "old", occurredAt: "2026-07-01T10:00:00.000Z" }],
      }),
      NOW,
    );
    const engagement = model.availableSignals.find((s) => s.signalId === "communication_recency");
    expect(engagement?.freshness).toBe("stale");
    expect(model.nextBestActions.some((a) => a.actionId === "re-engage-customer")).toBe(true);
  });

  it("fails closed when upstream read errors block authoritative inputs", () => {
    const model = buildCustomerHealthProjection(
      baseInput({ upstreamErrors: ["orders: permission denied"] }),
      NOW,
    );
    expect(model.category).toBe("indeterminate");
    expect(model.confidence).toBe(0);
    expect(model.nextBestActions[0]?.availability).toBe("unavailable");
  });

  it("does not invent sentiment, repeat-order, or sales trajectory signals", () => {
    const model = buildCustomerHealthProjection(baseInput(), NOW);
    expect(model.unavailableSignals.map((s) => s.signalId)).toEqual(
      expect.arrayContaining([
        "finance_ageing_exposure",
        "customer_sentiment",
        "repeat_order_expectation",
        "sales_trajectory",
      ]),
    );
  });

  it("scopes projection to the requested company identity", () => {
    const model = buildCustomerHealthProjection(baseInput(), NOW);
    expect(model.companyId).toBe(COMPANY_ID);
  });
});
