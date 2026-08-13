import { describe, expect, it } from "vitest";
import { summarizeWa3ClarificationQueue } from "./wa3ClarificationQueue";

describe("WA-3 clarification queue", () => {
  it("keeps ambiguous, conflicting, and overdue work visible", () => {
    const summary = summarizeWa3ClarificationQueue(
      [{ resolution_state: "ambiguous" }, { resolution_state: "conflicting" }, { resolution_state: "operator_confirmed" }],
      [{ status: "OPEN", due_at: "2026-08-13T10:00:00Z" }, { status: "ANSWERED", due_at: "2026-08-13T09:00:00Z" }],
      new Date("2026-08-13T11:00:00Z").getTime(),
    );
    expect(summary).toEqual({ unresolved: 2, conflicting: 1, open: 1, overdue: 1 });
  });
});
