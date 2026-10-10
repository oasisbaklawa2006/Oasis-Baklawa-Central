import { describe, expect, it } from "vitest";
import {
  POINT88_LIFECYCLE_RPCS,
  POINT89_EXCEPTION_RPCS,
  assertPoint88LifecycleRpc,
  isPoint88LifecycleRpc,
  isPoint89ExceptionRpc,
} from "../point88Scope";

describe("Point88 scope boundaries", () => {
  it("whitelists only governed lifecycle RPCs for Point88", () => {
    expect(POINT88_LIFECYCLE_RPCS).toContain("start_production_job");
    expect(POINT88_LIFECYCLE_RPCS).toContain("create_production_shortage_demand");
    expect(POINT88_LIFECYCLE_RPCS).not.toContain("report_production_issue");
  });

  it("routes exception RPCs to Point89", () => {
    expect(POINT89_EXCEPTION_RPCS).toEqual([
      "report_production_issue",
      "resolve_production_issue",
    ]);
    expect(isPoint89ExceptionRpc("report_production_issue")).toBe(true);
    expect(isPoint88LifecycleRpc("report_production_issue")).toBe(false);
  });

  it("fail-closes non-Point88 RPC names", () => {
    expect(() => assertPoint88LifecycleRpc("report_production_issue")).toThrow(/ROUTING REJECTED/);
    expect(assertPoint88LifecycleRpc("pause_production_job")).toBe("pause_production_job");
  });
});
