import { describe, expect, it } from "vitest";
import {
  canAccessThreePgsMobileUrgent,
  canAccessThreePgsOperator,
  canAccessThreePgsSatellite,
  canAccessThreePgsTv,
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
});
