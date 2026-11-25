import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Source contract for the six department wall displays: every one is behind TvDeviceRoute with its Core canonical group.
const app = readFileSync(resolve(process.cwd(), "src/App.tsx"), "utf8");

const ROUTES: Array<[string, string, string[]]> = [
  ["/tv/arabic-sweets", "ARABIC_SWEETS", ["HOD_ARABIC", "PROD_ARABIC_SWEETS", "SUPER_ADMIN", "ADMIN"]],
  ["/tv/chocolate", "CHOCOLATES_CONFECTIONERY", ["HOD_CHOCOLATE", "PROD_CHOCOLATE", "HOD_DRAGEES", "PROD_DRAGEES", "SUPER_ADMIN", "ADMIN"]],
  ["/tv/fusion", "FUSION_SWEETS", ["HOD_FUSION", "PROD_FUSION", "HOD_DATES", "PROD_DATES", "SUPER_ADMIN", "ADMIN"]],
  ["/tv/bakery", "BAKERY", ["HOD_BAKERY", "PROD_BAKERY", "SUPER_ADMIN", "ADMIN"]],
  ["/tv/nuts", "SEASONED_NUTS_MIXES", ["HOD_NUTS", "PROD_NUTS", "SUPER_ADMIN", "ADMIN"]],
  ["/tv/rgs", "RGS", ["STORE_READY_GOODS", "RGS_ADMIN", "TV_READY", "SUPER_ADMIN", "ADMIN"]],
];

const routeLine = (path: string) => app.split("\n").find((line) => line.includes(`<Route path="${path}"`)) ?? "";

describe("department TV routes", () => {
  it.each(ROUTES)("%s is guarded by TvDeviceRoute for %s with the unchanged staff roles", (path, group, roles) => {
    const line = routeLine(path);
    expect(line).toContain(`<TvDeviceRoute group="${group}"`);
    expect(line).toContain(`staffRoles={${JSON.stringify(roles).replace(/,/g, ", ")}}`);
    expect(line).not.toContain("<RoleProtectedRoute");
  });

  it("leaves the legacy dragees redirect, the 3PGS TV and the CMD War Room hub untouched", () => {
    expect(routeLine("/tv/dragees")).toContain('<Navigate to="/tv/chocolate" replace />');
    expect(routeLine("/tv/3pgs")).toContain('<RoleProtectedRoute allowedRoles={["STORE_3RD_PARTY", "OPERATIONS_MANAGER", "TV_3PGS", "SUPER_ADMIN", "ADMIN"]}>');
    expect(app).not.toMatch(/path="\/admin\/cmd-war-room"[^\n]*TvDeviceRoute/);
  });

  it("every TvDeviceRoute group is one of Core's canonical groups", () => {
    const groups = [...app.matchAll(/<TvDeviceRoute group="([A-Z_]+)"/g)].map((m) => m[1]);
    expect(groups.sort()).toEqual(ROUTES.map(([, g]) => g).sort());
  });
});
