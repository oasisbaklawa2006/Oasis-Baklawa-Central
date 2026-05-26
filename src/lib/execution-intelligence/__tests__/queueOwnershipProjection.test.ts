import { describe, expect, it } from "vitest";
import { countUnownedQueues, projectQueueOwnershipMatrix } from "../queueOwnershipProjection";
import { baseIntelligenceInput, queueItem } from "./fixtures";

describe("queueOwnershipProjection", () => {
  it("counts unowned open queues", () => {
    expect(countUnownedQueues(baseIntelligenceInput())).toBe(1);
  });

  it("flags overloaded actors", () => {
    const items = Array.from({ length: 10 }, (_, i) =>
      queueItem({ id: `q${i}`, assignedTo: "actor-1", ownerDepartment: "production" }),
    );
    const matrix = projectQueueOwnershipMatrix(baseIntelligenceInput({ queueItems: items }));
    expect(matrix.find((m) => m.actorKey === "actor-1")?.overloaded).toBe(true);
  });
});
