import { describe, expect, it } from "vitest";
import { resolveOperationalDependencies } from "../dependencyResolution";
import { projectDependencyEscalation } from "../dependencyEscalation";
import { financeBlocksProductionProjection } from "../dependencyProjection";
import { rootBlocker, type DependencyBlocker } from "../dependencyBlockers";

describe("dependency graph", () => {
  it("detects finance as root blocker when unsatisfied", () => {
    const result = resolveOperationalDependencies({ finance: false, production: false });
    expect(result.rootBlocker?.lane).toBe("finance");
    expect(result.customerImpact).toBe(true);
    expect(result.downstreamImpact.length).toBeGreaterThan(0);
  });

  it("returns no blockers when all lanes satisfied", () => {
    const result = resolveOperationalDependencies({
      finance: true,
      production: true,
      assembly: true,
      dispatch: true,
      scan: true,
      invoice: true,
      shipment: true,
      reservation: true,
      inventory_verification: true,
    });
    expect(result.blockers.length).toBe(0);
    expect(result.rootBlocker).toBeNull();
  });

  it("propagates escalation recommendation for blocked chain", () => {
    const result = resolveOperationalDependencies({ finance: false });
    const esc = projectDependencyEscalation(result);
    expect(esc.tier).not.toBe("none");
    expect(esc.recommendation).toContain("Root blocker");
  });

  it("finance blocks production projection is deterministic", () => {
    const p = financeBlocksProductionProjection();
    expect(p.resolution.rootBlocker?.lane).toBe("finance");
    expect(p.generatedAt).toBeTruthy();
  });

  it("rootBlocker prefers explicit root flag", () => {
    const blockers: DependencyBlocker[] = [
      { lane: "finance", label: "Finance", blockedBy: [], isRoot: true },
      { lane: "production", label: "Production", blockedBy: ["finance"], isRoot: false },
    ];
    expect(rootBlocker(blockers)?.lane).toBe("finance");
  });
});
