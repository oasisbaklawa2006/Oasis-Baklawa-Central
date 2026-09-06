import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "../../..");

function readSrc(relative: string): string {
  return readFileSync(join(ROOT, relative), "utf8");
}

describe("Point88 legacy production decommission", () => {
  it("AdminInventory no longer inserts into daily_production_logs", () => {
    const src = readSrc("pages/admin/AdminInventory.tsx");
    expect(src).not.toMatch(/from\(["']daily_production_logs["']\)\.insert/);
    expect(src).toContain("blockLegacyProductionMutation");
  });

  it("PHH lifecycle mutations route through productionGovernedRpc", () => {
    const intake = readSrc("components/phh/JobIntakeTab.tsx");
    const execution = readSrc("components/phh/JobExecutionTab.tsx");
    const quickEntry = readSrc("components/phh/QuickEntryTab.tsx");
    const dayEnd = readSrc("components/phh/DayEndSignoffTab.tsx");

    expect(intake).toContain("productionGovernedRpc");
    expect(execution).toContain("productionGovernedRpc");
    expect(quickEntry).toContain("productionGovernedRpc");
    expect(dayEnd).toContain("productionGovernedRpc");

    expect(intake).not.toMatch(/rgsGovernedRpc\.rpc\(["']accept_production_job/);
    expect(execution).not.toMatch(/rgsGovernedRpc\.rpc\(["']start_production_job/);
    expect(execution).not.toMatch(/rgsGovernedRpc\.rpc\(["']pause_production_job/);
    expect(execution).not.toMatch(/rgsGovernedRpc\.rpc\(["']declare_production_ready/);
  });

  it("Point89 exception RPCs remain outside productionGovernedRpc", () => {
    const execution = readSrc("components/phh/JobExecutionTab.tsx");
    expect(execution).toMatch(/rgsGovernedRpc\.rpc\(["']report_production_issue/);
    expect(execution).toMatch(/rgsGovernedRpc\.rpc\(["']resolve_production_issue/);
  });

  it("FactoryTVModule remains read-only with no governed RPC imports", () => {
    const tv = readSrc("components/FactoryTVModule.tsx");
    expect(tv).not.toContain("productionGovernedRpc");
    expect(tv).not.toContain("rgsGovernedRpc");
    expect(tv).not.toMatch(/\.rpc\(/);
    expect(tv).toContain('from("production_jobs")');
  });

  it("allocation surfaces use productionGovernedRpc for shortage demand", () => {
    const rgs = readSrc("pages/admin/ReadyGoodsStore.tsx");
    const planner = readSrc("pages/admin/RgsProductionDemandPlanner.tsx");
    expect(rgs).toContain("productionGovernedRpc.createShortageDemand");
    expect(planner).toContain("productionGovernedRpc.createShortageDemand");
    expect(planner).not.toMatch(/rgsGovernedRpc\.rpc\(["']create_production_shortage_demand/);
  });
});
