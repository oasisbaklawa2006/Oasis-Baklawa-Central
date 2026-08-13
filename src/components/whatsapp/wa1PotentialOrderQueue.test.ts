import { describe, expect, it } from "vitest";
import { summarizeWa1Queue, type Wa1PotentialOrder } from "./wa1PotentialOrderQueue";

describe("WA-1 potential-order operational queue", () => {
  it("keeps failed interpretation visible, unassigned and at-risk work accountable", () => {
    const base = { id: "1", disposition: "ACTIVE_PENDING", queue: "WA_FAILED_INTERPRETATION", next_action: "HUMAN_INTERPRETATION", next_action_due_at: new Date().toISOString(), owner_id: null } as const;
    const rows = [
      { ...base, state: "FAILED_INTERPRETATION" },
      { ...base, id: "2", state: "AT_RISK", owner_id: "operator" },
      { ...base, id: "3", state: "ESCALATED", owner_id: "manager" },
      { ...base, id: "4", state: "CONVERTED", disposition: "CONVERTED", owner_id: "operator" },
    ] as Wa1PotentialOrder[];
    expect(summarizeWa1Queue(rows)).toEqual({ active: 3, unassigned: 1, failed: 1, atRisk: 2 });
  });
});
