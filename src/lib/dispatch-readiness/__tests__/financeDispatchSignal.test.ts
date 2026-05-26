import { describe, expect, it } from "vitest";
import {
  financeSignalLabel,
  isFinanceSignalBlocking,
  isFinanceSignalReady,
  observeFinanceDispatchSignal,
} from "../financeDispatchSignal";

describe("financeDispatchSignal", () => {
  it("is read-only observe helper", () => {
    const o = observeFinanceDispatchSignal("order-1", "pending_review");
    expect(o.signal).toBe("pending_review");
    expect(o.orderId).toBe("order-1");
  });

  it("ready only when signal is ready", () => {
    expect(isFinanceSignalReady("ready")).toBe(true);
    expect(isFinanceSignalReady("unknown")).toBe(false);
  });

  it("blocked when signal blocked", () => {
    expect(isFinanceSignalBlocking("blocked")).toBe(true);
  });

  it("labels do not imply payment mutation", () => {
    expect(financeSignalLabel("ready")).not.toMatch(/capture|invoice|approve/i);
  });
});
