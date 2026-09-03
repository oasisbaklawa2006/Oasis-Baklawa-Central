import { expect, test } from "@playwright/test";
import * as fs from "fs";
import {
  canAccessThreePgsMobileUrgent,
  canAccessThreePgsSatellite,
  resolveThreePgsSatelliteAudience,
} from "../src/lib/threePgsAccess";

const appSource = fs.readFileSync(new URL("../src/App.tsx", import.meta.url), "utf-8");
const moduleGuard = fs.readFileSync(new URL("../src/components/AdminModuleRoute.tsx", import.meta.url), "utf-8");
const tvSurfaces = fs.readFileSync(new URL("../src/lib/appverse/tvSurfaces.ts", import.meta.url), "utf-8");
const authRouting = fs.readFileSync(new URL("../src/lib/auth-routing.ts", import.meta.url), "utf-8");

test.describe("R4.6 3PGS satellite/mobile/TV closure", () => {
  test("registers governed satellite, mobile urgent and TV routes", () => {
    expect(appSource).toContain('path="3pgs-visibility"');
    expect(appSource).toContain('path="3pgs-mobile-urgent"');
    expect(appSource).toContain('path="/tv/3pgs"');
    expect(appSource).toContain('path="3pgs-tv"');
  });

  test("applies role-scoped satellite and mobile guards in AdminModuleRoute", () => {
    expect(moduleGuard).toContain('pathname === "/admin/3pgs-visibility"');
    expect(moduleGuard).toContain("canAccessThreePgsSatellite(role)");
    expect(moduleGuard).toContain('pathname === "/admin/3pgs-mobile-urgent"');
    expect(moduleGuard).toContain("canAccessThreePgsMobileUrgent(role)");
  });

  test("exposes read-only 3PGS TV in the governed TV registry", () => {
    expect(tvSurfaces).toContain('route: "/tv/3pgs"');
    expect(tvSurfaces).toContain('"TV_3PGS"');
  });

  test("lands dedicated 3PGS TV accounts on the kiosk route", () => {
    expect(authRouting).toContain('TV_3PGS:                  "/tv/3pgs"');
  });

  test("keeps satellite visibility separate from operator authority", () => {
    expect(resolveThreePgsSatelliteAudience("HOD_ASSEMBLY")).toBe("pna");
    expect(canAccessThreePgsSatellite("HOD_ASSEMBLY")).toBe(true);
    expect(canAccessThreePgsMobileUrgent("HOD_ASSEMBLY")).toBe(false);
  });
});
