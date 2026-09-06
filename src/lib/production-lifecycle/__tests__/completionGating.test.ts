import { describe, expect, it } from "vitest";
import { assertPauseReasonProvided, evaluateCompletionGate } from "../completionGating";

describe("completion gating", () => {
  it("rejects zero produced quantity", () => {
    const result = evaluateCompletionGate({ producedQty: 0, wastedQty: 0, assignedQty: 10 });
    expect(result.allowed).toBe(false);
    if (result.allowed === false) expect(result.reason).toMatch(/greater than zero/);
  });

  it("rejects overage beyond 10%", () => {
    const result = evaluateCompletionGate({ producedQty: 10, wastedQty: 2, assignedQty: 10 });
    expect(result.allowed).toBe(false);
    if (result.allowed === false) expect(result.reason).toMatch(/exceeds assigned target/);
  });

  it("allows completion within tolerance", () => {
    const result = evaluateCompletionGate({ producedQty: 10, wastedQty: 1, assignedQty: 10 });
    expect(result).toEqual({ allowed: true });
  });

  it("requires pause reason before RPC", () => {
    expect(() => assertPauseReasonProvided("")).toThrow(/Pause reason is required/);
    expect(() => assertPauseReasonProvided("machine_breakdown")).not.toThrow();
  });
});
