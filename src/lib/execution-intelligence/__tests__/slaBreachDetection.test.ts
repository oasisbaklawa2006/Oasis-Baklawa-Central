import { describe, expect, it } from "vitest";
import { assessQueueSla, detectSlaBreaches } from "../slaBreachDetection";
import { baseIntelligenceInput, queueItem } from "./fixtures";

describe("slaBreachDetection", () => {
  it("marks old queue items as breached", () => {
    const r = assessQueueSla(queueItem({ id: "q1" }), "2026-05-24T12:00:00.000Z");
    expect(["breached", "critical", "aging"]).toContain(r.severity);
  });

  it("detects critical when blocked and breached", () => {
    const r = assessQueueSla(
      queueItem({ id: "q2", state: "blocked", blockerCode: "material", escalationLevel: "tier1" }),
      "2026-05-24T12:00:00.000Z",
    );
    expect(r.severity).toBe("critical");
  });

  it("sorts breaches before fresh", () => {
    const breaches = detectSlaBreaches(
      [
        queueItem({ id: "fresh", createdAt: "2026-05-24T11:00:00.000Z" }),
        queueItem({ id: "old", createdAt: "2026-05-10T08:00:00.000Z" }),
      ],
      "2026-05-24T12:00:00.000Z",
    );
    expect(breaches[0]?.queueItemId).toBe("old");
  });
});
