import { describe, expect, it } from "vitest";
import { deriveQueueFreshness } from "../queueFreshnessSla";

describe("queue freshness SLA", () => {
  it("returns breached when past slaDueAt", () => {
    expect(
      deriveQueueFreshness({
        queueId: "production_queue",
        nowIso: "2026-05-25T12:00:00Z",
        createdAt: "2026-05-24T12:00:00Z",
        acknowledgedAt: null,
        slaDueAt: "2026-05-25T10:00:00Z",
      }),
    ).toBe("breached");
  });

  it("returns stale when past stale threshold", () => {
    expect(
      deriveQueueFreshness({
        queueId: "dispatch_queue",
        nowIso: "2026-05-25T06:00:00Z",
        createdAt: "2026-05-25T00:00:00Z",
        acknowledgedAt: null,
        slaDueAt: null,
      }),
    ).toBe("stale");
  });
});
