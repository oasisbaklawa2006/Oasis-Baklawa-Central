import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  canAccessThreePgsMobileUrgent,
  canAccessThreePgsSatellite,
  canAccessThreePgsTv,
  resolveThreePgsSatelliteAudience,
} from "../src/lib/threePgsAccess";

// Use fixed module-relative literals instead of forwarding runtime paths into
// readFileSync, matching the Codacy-safe pattern used elsewhere in this repo.
const ROOT = join(import.meta.dirname, "..");

function readAppSource(): string {
  return readFileSync(join(ROOT, "src/App.tsx"), "utf8");
}

function readAdminModuleRouteSource(): string {
  return readFileSync(join(ROOT, "src/components/AdminModuleRoute.tsx"), "utf8");
}

function readTvSurfacesSource(): string {
  return readFileSync(join(ROOT, "src/lib/appverse/tvSurfaces.ts"), "utf8");
}

function readAuthRoutingSource(): string {
  return readFileSync(join(ROOT, "src/lib/auth-routing.ts"), "utf8");
}

test.describe("R4.6 3PGS satellite/mobile/TV closure", () => {
  test("registers governed satellite, mobile urgent and TV routes", () => {
    const appSource = readAppSource();
    expect(appSource).toContain('path="3pgs-visibility"');
    expect(appSource).toContain('path="3pgs-mobile-urgent"');
    expect(appSource).toContain('path="/tv/3pgs"');
    expect(appSource).toContain('path="3pgs-tv"');
  });

  test("applies role-scoped satellite and mobile guards in AdminModuleRoute", () => {
    const moduleGuard = readAdminModuleRouteSource();
    expect(moduleGuard).toContain('pathname === "/admin/3pgs-visibility"');
    expect(moduleGuard).toContain("canAccessThreePgsSatellite(role)");
    expect(moduleGuard).toContain('pathname === "/admin/3pgs-mobile-urgent"');
    expect(moduleGuard).toContain("canAccessThreePgsMobileUrgent(role)");
    expect(moduleGuard).toContain('pathname === "/admin/3pgs-tv"');
    expect(moduleGuard).toContain("canAccessThreePgsTv(role)");
  });

  test("exposes read-only 3PGS TV in the governed TV registry", () => {
    const tvSurfaces = readTvSurfacesSource();
    expect(tvSurfaces).toContain('route: "/tv/3pgs"');
    expect(tvSurfaces).toContain('"TV_3PGS"');
  });

  test("lands dedicated 3PGS TV accounts on the kiosk route", () => {
    const authRouting = readAuthRoutingSource();
    expect(authRouting).toContain('TV_3PGS:                  "/tv/3pgs"');
  });

  test("keeps satellite visibility separate from operator authority", () => {
    expect(resolveThreePgsSatelliteAudience("HOD_ASSEMBLY")).toBe("pna");
    expect(canAccessThreePgsSatellite("HOD_ASSEMBLY")).toBe(true);
    expect(canAccessThreePgsMobileUrgent("HOD_ASSEMBLY")).toBe(false);
  });

  test("keeps satellite and outlet roles off the unfiltered 3PGS TV surface", () => {
    const appSource = readAppSource();
    const staffRolesBlock = appSource.slice(
      appSource.indexOf("const ADMIN_STAFF_ROLES"),
      appSource.indexOf("const SALES_DASHBOARD_ROLES"),
    );
    expect(staffRolesBlock).not.toContain("TV_3PGS");
    expect(canAccessThreePgsTv("DISPATCH_MANAGER")).toBe(false);
    expect(canAccessThreePgsTv("DISPATCH_HEAD")).toBe(false);
    expect(canAccessThreePgsTv("STORE_READY_GOODS")).toBe(false);
    expect(canAccessThreePgsTv("STORE_INCHARGE")).toBe(false);
    expect(canAccessThreePgsTv("RGS_ADMIN")).toBe(false);
    expect(canAccessThreePgsTv("STORE_3RD_PARTY")).toBe(true);
    expect(canAccessThreePgsTv("TV_3PGS")).toBe(true);
  });
});
