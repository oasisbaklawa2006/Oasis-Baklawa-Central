import { describe, expect, it } from "vitest";
import {
  assertLifecycleTransition,
  canAdvanceStage,
  isStaleVersionError,
  isStatusAllowedForAction,
  isTerminalProductionStatus,
  nextStageAfter,
  ruleForAction,
} from "../lifecycleMatrix";

const baseJob = {
  id: "job-1",
  status: "accepted",
  stage: "prep",
  assigned_qty: 10,
};

describe("production lifecycle matrix", () => {
  it("allows start only from accepted", () => {
    expect(isStatusAllowedForAction("start", "accepted")).toBe(true);
    expect(isStatusAllowedForAction("start", "pending")).toBe(false);
    expect(isStatusAllowedForAction("start", "in_production")).toBe(false);
  });

  it("requires pause reason path to be in_production", () => {
    expect(isStatusAllowedForAction("pause", "in_production")).toBe(true);
    expect(isStatusAllowedForAction("pause", "paused")).toBe(false);
  });

  it("requires declare_ready at ready stage", () => {
    const rule = ruleForAction("declare_ready");
    expect(rule?.requiredStages).toEqual(["ready"]);
    expect(() =>
      assertLifecycleTransition("declare_ready", { ...baseJob, status: "in_production", stage: "prep" }),
    ).toThrow(/requires stage/);
  });

  it("computes the next stage in order", () => {
    expect(nextStageAfter("prep")).toBe("processing");
    expect(nextStageAfter("ready")).toBeNull();
  });

  it("blocks stage advance when already terminal", () => {
    expect(canAdvanceStage({ ...baseJob, status: "in_production", stage: "ready" })).toBe(false);
    expect(canAdvanceStage({ ...baseJob, status: "in_production", stage: "prep" })).toBe(true);
  });

  it("detects stale version errors from Core", () => {
    expect(isStaleVersionError("stale version mismatch")).toBe(true);
    expect(isStaleVersionError("expected_version does not match")).toBe(true);
    expect(isStaleVersionError("not authorized")).toBe(false);
  });

  it("marks rejected/completed/dispatched as terminal", () => {
    expect(isTerminalProductionStatus("rejected")).toBe(true);
    expect(isTerminalProductionStatus("in_production")).toBe(false);
  });
});
