import { describe, expect, it } from "vitest";
import {
  FACTORY_SOURCE_TRUTH,
  authoritativeFactoryTruthForSubsystem,
  factoryTruthForSubsystem,
  type FactoryTruthSubsystem,
} from "../factoryOperationsSourceTruthRegistry";

describe("Factory Operations source-truth registry", () => {
  it("contains no duplicate relation/subsystem entries", () => {
    const keys = FACTORY_SOURCE_TRUTH.map((entry) => `${entry.subsystem}:${entry.relation}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("gives every active Factory execution subsystem at least one source-truth declaration", () => {
    const subsystems: FactoryTruthSubsystem[] = [
      "PRODUCTION",
      "RGS",
      "ASSEMBLY",
      "3PGS",
      "INVENTORY",
      "DISPATCH",
      "TRACE_GATE",
    ];
    for (const subsystem of subsystems) {
      expect(factoryTruthForSubsystem(subsystem).length, `${subsystem} must have source-truth metadata`).toBeGreaterThan(0);
    }
  });

  it("keeps production_jobs as governed Production authority", () => {
    expect(authoritativeFactoryTruthForSubsystem("PRODUCTION").map((entry) => entry.relation)).toEqual(["production_jobs"]);
  });

  it("marks operational_queue_items as dead projection instead of Factory authority", () => {
    const legacy = FACTORY_SOURCE_TRUTH.find((entry) => entry.relation === "operational_queue_items");
    expect(legacy?.subsystem).toBe("LEGACY");
    expect(legacy?.status).toBe("DEAD_PROJECTION");
  });

  it("keeps P&A and 3PGS bridge authorities explicit", () => {
    expect(authoritativeFactoryTruthForSubsystem("ASSEMBLY").map((entry) => entry.relation)).toEqual(
      expect.arrayContaining([
        "b2b_assembly_jobs",
        "b2b_assembly_components",
        "b2b_assembly_handovers",
        "b2b_assembly_3pgs_requirements",
      ]),
    );
    expect(authoritativeFactoryTruthForSubsystem("3PGS").map((entry) => entry.relation)).toContain("b2b_procurement_requirements");
  });
});
