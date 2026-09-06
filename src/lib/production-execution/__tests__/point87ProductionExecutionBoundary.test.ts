import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  POINT87_ASM_ID,
  POINT87_AUTHORITY_RELATION,
  POINT87_COMPETING_LEGACY_SURFACES,
  POINT87_COMPLETION_HANDOFF_CHAIN,
  POINT87_DEPARTMENT_EXECUTION_CONTRACTS,
  POINT87_GOVERNED_RPC_ACTIONS,
  POINT87_HANDHELD_ROUTE,
  POINT87_LEGACY_PRODUCTION_REDIRECTS,
  POINT87_PROGRAMME_BOUNDARIES,
  POINT87_RGS_RECEIPT_RPC,
  POINT87_TV_READ_ONLY_RPC_DENYLIST,
  POINT87_TV_ROUTES,
  isPoint87CanonicalRoute,
  isPoint87LegacyProductionRoute,
  point87AllGovernedRpcs,
  point87CanonicalDepartments,
  point87ContractForDepartment,
  point87DepartmentIsolationMatch,
  point87LegacyRedirectTarget,
  point87TvRouteForDepartment,
} from "../point87ProductionExecutionBoundary";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("Point 87 — production department execution boundary", () => {
  describe("authority and programme identity", () => {
    it("declares POINT87 ASM identity and production_jobs authority", () => {
      expect(POINT87_ASM_ID).toBe("POINT87");
      expect(POINT87_AUTHORITY_RELATION).toBe("production_jobs");
    });

    it("separates Point 86/88/89 programme boundaries", () => {
      expect(POINT87_PROGRAMME_BOUNDARIES.point86.centralStatus).toBe("NOT_OWNED");
      expect(POINT87_PROGRAMME_BOUNDARIES.point88.centralStatus).toBe("PARTIALLY_CONSUMED");
      expect(POINT87_PROGRAMME_BOUNDARIES.point89.centralStatus).toBe("NOT_OWNED");
    });
  });

  describe("department census (configured production departments)", () => {
    it("covers all six owner TV estate departments", () => {
      expect(point87CanonicalDepartments()).toEqual([
        "ARABIC_SWEETS",
        "CHOCOLATES_CONFECTIONERY",
        "FUSION_SWEETS",
        "SEASONED_NUTS_MIXES",
        "BAKERY",
      ]);
    });

    it("maps each canonical department to exactly one TV route", () => {
      for (const contract of POINT87_DEPARTMENT_EXECUTION_CONTRACTS) {
        expect(point87TvRouteForDepartment(contract.canonicalDepartment)).toBe(contract.tvRoute);
        expect(point87ContractForDepartment(contract.canonicalDepartment)?.label).toBe(contract.label);
      }
    });

    it("groups dates under Fusion and dragees under Chocolate TVs", () => {
      const fusion = point87ContractForDepartment("FUSION_SWEETS");
      const chocolate = point87ContractForDepartment("CHOCOLATES_CONFECTIONERY");
      expect(fusion?.rawProductDepartments).toContain("dates");
      expect(chocolate?.rawProductDepartments).toContain("dragees");
    });

    it("exposes five distinct TV routes for the six-TV estate", () => {
      expect(POINT87_TV_ROUTES).toHaveLength(5);
      expect(new Set(POINT87_TV_ROUTES).size).toBe(5);
    });
  });

  describe("canonical routes", () => {
    it("recognises the handheld PHH surface as canonical", () => {
      expect(isPoint87CanonicalRoute(POINT87_HANDHELD_ROUTE)).toBe(true);
      expect(POINT87_HANDHELD_ROUTE).toBe("/operations-controller");
    });

    it("recognises all production TV routes as canonical", () => {
      for (const route of POINT87_TV_ROUTES) {
        expect(isPoint87CanonicalRoute(route)).toBe(true);
      }
    });

    it("does not treat retail/complaints legacy boards as canonical", () => {
      for (const route of POINT87_COMPETING_LEGACY_SURFACES) {
        expect(isPoint87CanonicalRoute(route)).toBe(false);
      }
    });
  });

  describe("legacy disposition", () => {
    it("redirects legacy production execution board to PHH", () => {
      expect(isPoint87LegacyProductionRoute("/admin/execution/production")).toBe(true);
      expect(point87LegacyRedirectTarget("/admin/execution/production")).toBe("/operations-controller");
      expect(POINT87_LEGACY_PRODUCTION_REDIRECTS).toContainEqual({
        legacyRoute: "/admin/execution/production",
        canonicalTarget: "/operations-controller",
      });
    });

    it("ProductionExecutionBoard wrapper redirects without mounting DepartmentExecutionBoard", () => {
      const legacyBoard = source("src/pages/admin/execution/ProductionExecutionBoard.tsx");
      expect(legacyBoard).toContain('<Navigate to="/operations-controller" replace />');
      expect(legacyBoard).not.toMatch(/(?:import\s+.*DepartmentExecutionBoard|<DepartmentExecutionBoard\b)/);
    });

    it("App.tsx redirects /admin/execution/production at the router level", () => {
      const app = source("src/App.tsx");
      expect(app).toMatch(/path="execution\/production"\s+element=\{<Navigate to="\/operations-controller"/);
    });

    it("AdminLayout nav links directly to operations-controller", () => {
      const layout = source("src/components/AdminLayout.tsx");
      expect(layout).toContain('to: "/operations-controller"');
      expect(layout).not.toContain('to: "/admin/execution/production"');
    });

    it("roleHome shortcuts land on operations-controller", () => {
      const roleHome = source("src/lib/appverse/roleHome.ts");
      expect(roleHome).toContain('route: "/operations-controller"');
      expect(roleHome).not.toContain('route: "/admin/execution/production"');
    });
  });

  describe("job binding and department isolation", () => {
    it("matches jobs only to their canonical department surface", () => {
      expect(point87DepartmentIsolationMatch("ARABIC_SWEETS", "ARABIC_SWEETS")).toBe(true);
      expect(point87DepartmentIsolationMatch("ARABIC_SWEETS", "BAKERY")).toBe(false);
    });

    it("OperationsController queries by canonical_department", () => {
      const controller = source("src/pages/admin/OperationsController.tsx");
      expect(controller).toContain('.eq("canonical_department", myDepartment)');
      expect(controller).not.toMatch(/\.eq\("department",\s*myDepartment\)/);
    });

    it("FactoryTVModule scopes jobs to the TV department group", () => {
      const tv = source("src/components/FactoryTVModule.tsx");
      expect(tv).toContain("production_jobs");
      expect(tv).toContain("tvGroupOf");
      expect(tv).not.toContain("rgsGovernedRpc");
    });
  });

  describe("action routing (governed RPCs only)", () => {
    it("declares the full governed RPC action map", () => {
      const all = point87AllGovernedRpcs();
      expect(all).toContain("accept_production_job");
      expect(all).toContain("start_production_job");
      expect(all).toContain("dispatch_production_to_rgs");
      expect(all).toContain("submit_production_day_end");
      expect(all.length).toBe(
        Object.values(POINT87_GOVERNED_RPC_ACTIONS).flat().length,
      );
    });

    it("JobIntakeTab routes accept/reject through governed RPCs", () => {
      const intake = source("src/components/phh/JobIntakeTab.tsx");
      expect(intake).toContain('"accept_production_job"');
      expect(intake).toContain('"reject_production_job"');
      expect(intake).not.toMatch(/\.from\("production_jobs"\)[\s\S]*\.(insert|update|delete)/);
    });

    it("JobExecutionTab routes lifecycle and completion through governed RPCs", () => {
      const execution = source("src/components/phh/JobExecutionTab.tsx");
      for (const rpc of [
        "start_production_job",
        "pause_production_job",
        "resume_production_job",
        "advance_production_job_stage",
        "record_production_output",
        "declare_production_ready",
        "dispatch_production_to_rgs",
        "report_production_issue",
        "resolve_production_issue",
      ]) {
        expect(execution).toContain(`"${rpc}"`);
      }
      expect(execution).not.toMatch(/\.from\("production_jobs"\)[\s\S]*\.(insert|update|delete)/);
    });

    it("DayEndSignoffTab submits through submit_production_day_end only", () => {
      const dayEnd = source("src/components/phh/DayEndSignoffTab.tsx");
      expect(dayEnd).toContain('"submit_production_day_end"');
    });

    it("QuickEntryTab routes ad-hoc logging through quick_log_production_to_rgs", () => {
      const quick = source("src/components/phh/QuickEntryTab.tsx");
      expect(quick).toContain('"quick_log_production_to_rgs"');
    });
  });

  describe("completion handoff chain", () => {
    it("orders output → ready → RGS dispatch", () => {
      expect(POINT87_COMPLETION_HANDOFF_CHAIN).toEqual([
        "record_production_output",
        "declare_production_ready",
        "dispatch_production_to_rgs",
      ]);
    });

    it("JobExecutionTab invokes the handoff chain in sequence", () => {
      const execution = source("src/components/phh/JobExecutionTab.tsx");
      const outputIdx = execution.indexOf('"record_production_output"');
      const readyIdx = execution.indexOf('"declare_production_ready"');
      const dispatchIdx = execution.indexOf('"dispatch_production_to_rgs"');
      expect(outputIdx).toBeGreaterThan(-1);
      expect(readyIdx).toBeGreaterThan(outputIdx);
      expect(dispatchIdx).toBeGreaterThan(readyIdx);
    });

    it("declares downstream RGS receipt RPC outside execution boundary", () => {
      expect(POINT87_RGS_RECEIPT_RPC).toBe("accept_rgs_production_receipt");
      const rgs = source("src/pages/admin/ReadyGoodsStore.tsx");
      expect(rgs).toContain('"accept_rgs_production_receipt"');
    });
  });

  describe("unavailable states (fail closed)", () => {
    it("FactoryTVModule surfaces load errors instead of empty truth", () => {
      const tv = source("src/components/FactoryTVModule.tsx");
      expect(tv).toContain('setError(`Unrecognised department filter:');
      expect(tv).toMatch(/if \(error\)/);
    });

    it("JobIntakeTab requires rejection reason before reject RPC", () => {
      const intake = source("src/components/phh/JobIntakeTab.tsx");
      expect(intake).toContain('toast.error("Rejection reason is required")');
    });

    it("JobExecutionTab surfaces RPC errors via toast without silent success", () => {
      const execution = source("src/components/phh/JobExecutionTab.tsx");
      expect(execution).toMatch(/toast\.error\(error\.message/);
    });

    it("rgsGovernedRpc is the only mutation boundary for PHH lifecycle", () => {
      const phhFiles = [
        "src/components/phh/JobIntakeTab.tsx",
        "src/components/phh/JobExecutionTab.tsx",
        "src/components/phh/QuickEntryTab.tsx",
        "src/components/phh/DayEndSignoffTab.tsx",
      ];
      for (const file of phhFiles) {
        const content = source(file);
        expect(content).toContain("rgsGovernedRpc");
      }
    });
  });

  describe("TV read-only behavior", () => {
    it("denies all governed RPCs on TV surfaces", () => {
      expect(POINT87_TV_READ_ONLY_RPC_DENYLIST.length).toBeGreaterThan(0);
      for (const rpc of point87AllGovernedRpcs()) {
        expect(POINT87_TV_READ_ONLY_RPC_DENYLIST).toContain(rpc);
      }
    });

    it("FactoryTVModule has no mutation RPC imports or calls", () => {
      const tv = source("src/components/FactoryTVModule.tsx");
      expect(tv).not.toContain("rgsGovernedRpc");
      expect(tv).not.toMatch(/\.rpc\(/);
      expect(tv).not.toMatch(/\.(insert|update|delete|upsert)\(/);
    });

    it("production-truth certification compares TV DOM to authoritative production_jobs", () => {
      const cert = source("tests/factory-operations-production-truth.cert.spec.ts");
      expect(cert).toContain("readAuthoritativeProductionJobs");
      expect(cert).toContain("[data-job-id]");
      expect(cert).toContain("data-canonical-department");
    });
  });

  describe("source-truth registry alignment", () => {
    it("keeps production_jobs authoritative in factory source-truth registry", () => {
      const registry = source("src/lib/factoryOperationsSourceTruthRegistry.ts");
      expect(registry).toMatch(/relation:\s*"production_jobs"/);
      expect(registry).toMatch(/status:\s*"AUTHORITATIVE"/);
      expect(registry).toContain("OperationsController");
      expect(registry).toContain("FactoryTVModule");
    });

    it("marks operational_queue_items as dead projection", () => {
      const registry = source("src/lib/factoryOperationsSourceTruthRegistry.ts");
      expect(registry).toMatch(/relation:\s*"operational_queue_items"/);
      expect(registry).toMatch(/status:\s*"DEAD_PROJECTION"/);
    });
  });
});
