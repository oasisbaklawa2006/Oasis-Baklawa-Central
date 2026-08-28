import { expect, test } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { THREE_PGS_OPERATOR_ROLES, canAccessThreePgsOperator } from "../src/lib/threePgsAccess";
import { getRoleDestination } from "../src/lib/auth-routing";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (relative: string) => fs.readFileSync(path.resolve(__dirname, "..", relative), "utf-8");

const legacyBoard = read("src/pages/admin/execution/ThirdPartyExecutionBoard.tsx");
const moduleGuard = read("src/components/AdminModuleRoute.tsx");

test.describe("R4 3PGS route closure", () => {
  test("STORE_3RD_PARTY lands on the governed priority/procurement queue", () => {
    expect(getRoleDestination("STORE_3RD_PARTY")).toBe("/admin/3pgs-procurement-queue");
  });

  test("dead third-party execution board redirects to the governed queue", () => {
    expect(legacyBoard).toContain('<Navigate to="/admin/3pgs-procurement-queue" replace />');
    expect(legacyBoard).not.toContain("DepartmentExecutionBoard");
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
    expect(moduleGuard).toContain('location.pathname === "/admin/3pgs-procurement-queue"');
    expect(moduleGuard).toContain("!canAccessThreePgsOperator(role)");
  });
});
