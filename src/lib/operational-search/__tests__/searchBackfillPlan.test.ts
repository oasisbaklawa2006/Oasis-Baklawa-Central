import { describe, expect, it } from "vitest";
import { buildSearchBackfillDryRunPlan } from "../searchBackfillPlan";

describe("searchBackfillPlan", () => {
  it("returns dry-run counts without automation", () => {
    const plan = buildSearchBackfillDryRunPlan({ orders: 10, events: 50 });
    expect(plan.projectedEntryCount).toBe(60);
    expect(plan.forbiddenAutomation).toContain("cron");
    expect(plan.forbiddenAutomation.some((f) => f.includes("production backfill"))).toBe(true);
  });
});
