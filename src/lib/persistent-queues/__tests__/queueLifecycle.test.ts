import { describe, expect, it } from "vitest";
import type { PersistentQueueState } from "../persistentQueueTypes";
import {
  applyQueueLifecycleTransition,
  isOpenQueueState,
  isTerminalQueueState,
} from "../queueLifecycle";

describe("persistent queue lifecycle", () => {
  it("allows pending → acknowledged → assigned → in_progress → completed", () => {
    let state: PersistentQueueState = "pending";
    for (const action of ["acknowledge", "assign", "start", "complete"] as const) {
      const result = applyQueueLifecycleTransition({ from: state, action });
      expect(result.ok).toBe(true);
      if (result.ok) state = result.to;
    }
    expect(state).toBe("completed");
    expect(isTerminalQueueState(state)).toBe(true);
  });

  it("rejects finance-style silent complete from pending", () => {
    const result = applyQueueLifecycleTransition({ from: "pending", action: "complete" });
    expect(result.ok).toBe(false);
  });

  it("allows failed → pending retry", () => {
    const result = applyQueueLifecycleTransition({ from: "failed", action: "retry" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.to).toBe("pending");
  });

  it("blocks illegal escalate from completed", () => {
    const result = applyQueueLifecycleTransition({ from: "completed", action: "escalate" });
    expect(result.ok).toBe(false);
  });

  it("classifies open vs terminal states", () => {
    expect(isOpenQueueState("in_progress")).toBe(true);
    expect(isOpenQueueState("failed")).toBe(false);
    expect(isTerminalQueueState("cancelled")).toBe(true);
  });
});
