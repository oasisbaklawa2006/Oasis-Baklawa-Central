import { expect, test } from "@playwright/test";
import * as fs from "fs";

const appTsx = fs.readFileSync(new URL("../src/App.tsx", import.meta.url), "utf-8");
const adminLayout = fs.readFileSync(
  new URL("../src/components/AdminLayout.tsx", import.meta.url),
  "utf-8",
);
const roleHome = fs.readFileSync(
  new URL("../src/lib/appverse/roleHome.ts", import.meta.url),
  "utf-8",
);
const departmentBoardConfig = fs.readFileSync(
  new URL("../src/lib/execution-boards/departmentBoardConfig.ts", import.meta.url),
  "utf-8",
);

test.describe("Lane D dispatch execution-board closure (Point 55)", () => {
  test("dead dispatch execution URL redirects to governed Dispatch Management in App.tsx", () => {
    expect(appTsx).toContain(
      '<Route path="execution/dispatch" element={<Navigate to="/admin/dispatch-mgmt" replace',
    );
  });

  test("operator navigation surfaces point at dispatch-mgmt, not the legacy execution URL", () => {
    expect(adminLayout).toContain('to: "/admin/dispatch-mgmt"');
    expect(adminLayout).not.toContain('to: "/admin/execution/dispatch"');
    expect(roleHome).toContain('route: "/admin/dispatch-mgmt"');
    expect(roleHome).not.toContain('route: "/admin/execution/dispatch"');
    expect(departmentBoardConfig).toContain('route: "/admin/dispatch-mgmt"');
    expect(departmentBoardConfig).not.toContain('route: "/admin/execution/dispatch"');
  });
});
