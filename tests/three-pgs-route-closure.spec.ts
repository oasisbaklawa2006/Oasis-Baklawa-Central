import { expect, test } from "@playwright/test";
import * as fs from "fs";
import { THREE_PGS_OPERATOR_ROLES, canAccessThreePgsOperator } from "../src/lib/threePgsAccess";

// Use fixed module-relative URLs instead of resolving caller-supplied paths.
// This keeps the source-contract checks deterministic without exposing a
// dynamic filesystem path sink for the security scanner.
const authRouting = fs.readFileSync(new URL("../src/lib/auth-routing.ts", import.meta.url), "utf-8");
const legacyBoard = fs.readFileSync(
  new URL("../src/pages/admin/execution/ThirdPartyExecutionBoard.tsx", import.meta.url),
  "utf-8",
);
const moduleGuard = fs.readFileSync(new URL("../src/components/AdminModuleRoute.tsx", import.meta.url), "utf-8");

test.describe("R4 3PGS route closure", () => {
  test("STORE_3RD_PARTY lands on the governed priority/procurement queue", () => {
    expect(authRouting).toContain('STORE_3RD_PARTY:          "/admin/3pgs-procurement-queue"');
  });

  test("dead third-party execution board redirects to the governed queue", () => {
    expect(legacyBoard).toContain('<Navigate to="/admin/3pgs-procurement-queue" replace />');
    // The file's own explanatory comment legitimately names the retired
    // component; only its actual usage (an import or a rendered tag) is
    // forbidden.
    expect(legacyBoard).not.toMatch(/(?:import\s+.*DepartmentExecutionBoard|<DepartmentExecutionBoard\b)/);
  });

  test("operator role set is narrow and explicit", () => {
    expect([...THREE_PGS_OPERATOR_ROLES]).toEqual([
      "SUPER_ADMIN",
      "ADMIN",
      "OPERATIONS_MANAGER",
      "STORE_3RD_PARTY",
    ]);
    expect(canAccessThreePgsOperator("STORE_3RD_PARTY")).toBe(true);
    expect(canAccessThreePgsOperator("DISPATCH_MANAGER")).toBe(false);
    expect(canAccessThreePgsOperator("STORE_READY_GOODS")).toBe(false);
  });

  test("admin module boundary applies the 3PGS operator gate", () => {
    expect(moduleGuard).toContain('normalizePathname(location.pathname) === "/admin/3pgs-procurement-queue"');
    expect(moduleGuard).toContain("!canAccessThreePgsOperator(role)");
  });
});
