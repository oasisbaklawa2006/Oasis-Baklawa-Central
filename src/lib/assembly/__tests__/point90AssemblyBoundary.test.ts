import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { FACTORY_OPERATIONS_ROUTES } from "../../factoryOperationsRouteRegistry";
import { FACTORY_SOURCE_TRUTH } from "../../factoryOperationsSourceTruthRegistry";
import { ASSEMBLY_GOVERNED_RPCS } from "../assemblyRpcCatalog";

const repoRoot = resolve(import.meta.dirname, "../../../..");

function readSource(relativePath: string): string {
  return readFileSync(resolve(repoRoot, relativePath), "utf8");
}

describe("Point90 assembly canonical boundary", () => {
  it("keeps /admin/assembly-tasks as the sole FACTORY_CURRENT assembly execution surface", () => {
    const assemblyRoutes = FACTORY_OPERATIONS_ROUTES.filter((entry) => entry.subsystem === "ASSEMBLY_PACKING");
    const current = assemblyRoutes.filter((entry) => entry.status === "FACTORY_CURRENT");
    expect(current.map((entry) => entry.route)).toContain("/admin/assembly-tasks");
    expect(current.filter((entry) => entry.route.includes("assembly")).length).toBe(2);
  });

  it("redirects legacy /admin/execution/assembly to the canonical assembly tasks surface", () => {
    const legacy = FACTORY_OPERATIONS_ROUTES.find((entry) => entry.route === "/admin/execution/assembly");
    expect(legacy?.status).toBe("LEGACY_REDIRECT");
    expect(legacy?.legacyRedirectTarget).toBe("/admin/assembly-tasks");
  });

  it("declares AssemblyTV as a read consumer of b2b_assembly_jobs authority", () => {
    const jobsTruth = FACTORY_SOURCE_TRUTH.find((entry) => entry.relation === "b2b_assembly_jobs");
    expect(jobsTruth?.readConsumers).toEqual(
      expect.arrayContaining(["AssemblyManagement", "AssemblyTV", "InventoryCommandCenter"]),
    );
    expect(jobsTruth?.writeAuthority).toMatch(/Governed P&A assembly RPC lifecycle/);
  });

  it("routes AssemblyManagement mutations only through the governed RPC catalog", () => {
    const source = readSource("src/pages/admin/AssemblyManagement.tsx");
    for (const rpc of ASSEMBLY_GOVERNED_RPCS) {
      expect(source).toContain(`"${rpc}"`);
    }
    expect(source).not.toMatch(/\.from\("b2b_assembly_jobs"\)\.(insert|update|upsert|delete)/);
    expect(source).not.toMatch(/\.from\("b2b_assembly_components"\)\.(insert|update|upsert|delete)/);
  });

  it("keeps AssemblyTV read-only with no governed RPC mutation calls", () => {
    const source = readSource("src/pages/admin/AssemblyTV.tsx");
    expect(source).toContain("assemblyJobReadBoundary");
    expect(source).not.toContain("pnaAssemblyRpc");
    expect(source).not.toMatch(/\.(insert|update|upsert|delete)\(/);
    expect(source).not.toMatch(/<Button/);
  });

  it("lands assembly roles on the canonical tasks surface, not the legacy execution board", () => {
    const source = readSource("src/lib/auth-routing.ts");
    expect(source).toContain('HOD_ASSEMBLY:             "/admin/assembly-tasks"');
    expect(source).toContain('ASSEMBLY_MANAGER:         "/admin/assembly-tasks"');
    expect(source).not.toContain('TV_ASSEMBLY:              "/admin/assembly-tv"');
  });
});
