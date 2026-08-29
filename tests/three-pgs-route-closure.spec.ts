import { expect, test } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { THREE_PGS_OPERATOR_ROLES, canAccessThreePgsOperator } from "../src/lib/threePgsAccess";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (relative: string) => fs.readFileSync(path.resolve(__dirname, "..", relative), "utf-8");

// auth-routing.ts imports the live Supabase client singleton at module scope
// (it needs `supabase` for other exports), which throws outside a Vite
// runtime because `import.meta.env` is undefined under Playwright's Node
// test loader. This spec therefore asserts the destination mapping against
// source text, matching the pattern already used below for the other two
// route-closure checks, instead of importing auth-routing.ts directly.
const authRouting = read("src/lib/auth-routing.ts");
const legacyBoard = read("src/pages/admin/execution/ThirdPartyExecutionBoard.tsx");
const moduleGuard = read("src/components/AdminModuleRoute.tsx");

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
    expect(moduleGuard).toContain('location.pathname === "/admin/3pgs-procurement-queue"');
    expect(moduleGuard).toContain("!canAccessThreePgsOperator(role)");
  });
});
