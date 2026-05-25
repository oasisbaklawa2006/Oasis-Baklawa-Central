import { describe, expect, it } from "vitest";
import { buildEscalationTopology } from "../escalationTopology";
import { baseIntelligenceInput, queueItem } from "./fixtures";

describe("escalationTopology", () => {
  it("clusters escalations by department", () => {
    const topo = buildEscalationTopology(
      baseIntelligenceInput({
        queueItems: [
          queueItem({ id: "q1", escalationLevel: "tier1", ownerDepartment: "dispatch" }),
          queueItem({ id: "q2", state: "blocked", ownerDepartment: "dispatch" }),
        ],
      }),
    );
    expect(topo[0]?.department).toBe("dispatch");
    expect(topo[0]?.escalationCount).toBeGreaterThan(0);
  });
});
