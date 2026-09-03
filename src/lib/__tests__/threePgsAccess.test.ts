import { describe, expect, it } from "vitest";
import {
  canAccessThreePgsMobileUrgent,
  canAccessThreePgsOperator,
  canAccessThreePgsSatellite,
  canAccessThreePgsTv,
  canAccessThreePgsTvAdminShell,
  resolveThreePgsSatelliteAudience,
} from "@/lib/threePgsAccess";

describe("threePgsAccess R4.6", () => {
  it("keeps operator access narrow", () => {
    expect(canAccessThreePgsOperator("STORE_3RD_PARTY")).toBe(true);
    expect(canAccessThreePgsOperator("HOD_ASSEMBLY")).toBe(false);
    expect(canAccessThreePgsOperator("DISPATCH_MANAGER")).toBe(false);
  });

  it("maps satellite audiences by role without granting operator access", () => {
    expect(resolveThreePgsSatelliteAudience("HOD_ASSEMBLY")).toBe("pna");
    expect(resolveThreePgsSatelliteAudience("STORE_READY_GOODS")).toBe("outlet");
    expect(resolveThreePgsSatelliteAudience("SALES_EXECUTIVE")).toBe("b2b");
    expect(resolveThreePgsSatelliteAudience("DISPATCH_MANAGER")).toBe("dispatch");
    expect(canAccessThreePgsSatellite("HOD_ASSEMBLY")).toBe(true);
    expect(canAccessThreePgsOperator("HOD_ASSEMBLY")).toBe(false);
  });

  it("allows mobile urgent access only for operator roles", () => {
    expect(canAccessThreePgsMobileUrgent("STORE_3RD_PARTY")).toBe(true);
    expect(canAccessThreePgsMobileUrgent("HOD_ASSEMBLY")).toBe(false);
  });

  it("allows TV access for 3PGS operator and dedicated TV role", () => {
    expect(canAccessThreePgsTv("STORE_3RD_PARTY")).toBe(true);
    expect(canAccessThreePgsTv("TV_3PGS")).toBe(true);
    expect(canAccessThreePgsTv("HOD_ASSEMBLY")).toBe(false);
  });

  it("denies satellite and outlet roles access to the unfiltered 3PGS TV surface", () => {
    expect(canAccessThreePgsTv("DISPATCH_MANAGER")).toBe(false);
    expect(canAccessThreePgsTv("DISPATCH_HEAD")).toBe(false);
    expect(canAccessThreePgsTv("STORE_READY_GOODS")).toBe(false);
    expect(canAccessThreePgsTv("STORE_INCHARGE")).toBe(false);
    expect(canAccessThreePgsTv("RGS_ADMIN")).toBe(false);
  });

  it("allows kiosk and operator roles on the dedicated 3PGS TV predicate", () => {
    expect(canAccessThreePgsTv("STORE_3RD_PARTY")).toBe(true);
    expect(canAccessThreePgsTv("TV_3PGS")).toBe(true);
    expect(canAccessThreePgsTv("OPERATIONS_MANAGER")).toBe(true);
  });

  it("keeps kiosk-only TV_3PGS off the admin-shell alias without widening module access", () => {
    expect(canAccessThreePgsTvAdminShell("TV_3PGS")).toBe(false);
    expect(canAccessThreePgsTvAdminShell("STORE_3RD_PARTY")).toBe(true);
    expect(canAccessThreePgsTvAdminShell("OPERATIONS_MANAGER")).toBe(true);
    expect(canAccessThreePgsTvAdminShell("DISPATCH_MANAGER")).toBe(false);
  });
});
