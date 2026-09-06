import { expect, test } from "@playwright/test";
import * as fs from "fs";
import {
  POINT87_HANDHELD_ROUTE,
  POINT87_LEGACY_PRODUCTION_REDIRECTS,
  POINT87_TV_ROUTES,
  point87CanonicalDepartments,
} from "../src/lib/production-execution/point87ProductionExecutionBoundary";

const authRouting = fs.readFileSync(new URL("../src/lib/auth-routing.ts", import.meta.url), "utf-8");
const legacyBoard = fs.readFileSync(
  new URL("../src/pages/admin/execution/ProductionExecutionBoard.tsx", import.meta.url),
  "utf-8",
);
const appRoutes = fs.readFileSync(new URL("../src/App.tsx", import.meta.url), "utf-8");

test.describe("Point 87 production execution route closure", () => {
  test("HOD and production manager roles land on the governed PHH surface", () => {
    expect(authRouting).toContain(`PRODUCTION_MANAGER:       "${POINT87_HANDHELD_ROUTE}"`);
    expect(authRouting).toContain(`HOD_ARABIC:               "${POINT87_HANDHELD_ROUTE}"`);
    expect(authRouting).toContain(`OPERATIONS_MANAGER:       "${POINT87_HANDHELD_ROUTE}"`);
  });

  test("dead production execution board redirects to operations-controller", () => {
    expect(legacyBoard).toContain(`<Navigate to="${POINT87_HANDHELD_ROUTE}" replace />`);
    expect(legacyBoard).not.toMatch(/(?:import\s+.*DepartmentExecutionBoard|<DepartmentExecutionBoard\b)/);
  });

  test("App.tsx router redirects legacy production execution URL", () => {
    for (const redirect of POINT87_LEGACY_PRODUCTION_REDIRECTS) {
      expect(appRoutes).toContain(`<Navigate to="${redirect.canonicalTarget}"`);
    }
  });

  test("five TV routes cover all configured canonical departments", () => {
    expect(POINT87_TV_ROUTES).toHaveLength(5);
    expect(point87CanonicalDepartments()).toHaveLength(5);
    for (const route of POINT87_TV_ROUTES) {
      expect(appRoutes).toContain(`path="${route}"`);
    }
  });
});
