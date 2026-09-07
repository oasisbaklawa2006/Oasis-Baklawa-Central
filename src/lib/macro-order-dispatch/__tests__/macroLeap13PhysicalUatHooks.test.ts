import { describe, expect, it } from "vitest";
import {
  leap13DeferredScenarios,
  leap13HookSelector,
  leap13ScenariosForStage,
  MACRO_LEAP13_JOURNEY_HOOK_BINDINGS,
  MACRO_LEAP13_UAT_HOOK,
  MACRO_LEAP13_UAT_SCENARIOS,
} from "@/lib/macro-order-dispatch/macroLeap13PhysicalUatHooks";
import { MACRO_ORDER_DISPATCH_JOURNEY, MACRO_PHYSICAL_UAT_DEFERRED } from "@/lib/macro-order-dispatch/macroOrderDispatchJourney";

describe("macroLeap13PhysicalUatHooks", () => {
  it("binds every journey stage to a stable hook id", () => {
    expect(MACRO_LEAP13_JOURNEY_HOOK_BINDINGS).toHaveLength(MACRO_ORDER_DISPATCH_JOURNEY.length);
    for (const binding of MACRO_LEAP13_JOURNEY_HOOK_BINDINGS) {
      expect(binding.hookId).toMatch(/^macro-/);
      expect(binding.route).toBe(
        MACRO_ORDER_DISPATCH_JOURNEY.find((stage) => stage.key === binding.stageKey)?.route,
      );
    }
  });

  it("declares executable scenarios without claiming deferred physical PASS", () => {
    expect(MACRO_LEAP13_UAT_SCENARIOS.length).toBeGreaterThanOrEqual(9);
    const deferred = leap13DeferredScenarios();
    for (const scenario of deferred) {
      expect(scenario.physicalDeferred).toBe(true);
      expect(scenario.deferredPassKey).toBeDefined();
      expect(MACRO_PHYSICAL_UAT_DEFERRED).toContain(scenario.deferredPassKey);
    }
  });

  it("covers security gate terminal chain hooks", () => {
    const gateScenarios = leap13ScenariosForStage("security_gate");
    const hookIds = gateScenarios.map((scenario) => scenario.hookId);
    expect(hookIds).toContain(MACRO_LEAP13_UAT_HOOK.SECURITY_GATE_SCANNER);
    expect(hookIds).toContain(MACRO_LEAP13_UAT_HOOK.SECURITY_GATE_DISPATCH_PROOF);
    expect(hookIds).toContain(MACRO_LEAP13_UAT_HOOK.SECURITY_GATE_CUSTOMER_COMM);
  });

  it("builds Playwright selectors from hook ids", () => {
    expect(leap13HookSelector(MACRO_LEAP13_UAT_HOOK.ORDER_POOL)).toBe(
      '[data-testid="macro-order-pool-surface"]',
    );
  });
});
