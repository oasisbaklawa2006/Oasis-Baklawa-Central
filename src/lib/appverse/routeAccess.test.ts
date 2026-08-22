import { describe, expect, it } from "vitest";
import { getRequiredModuleForAdminPath } from "./routeAccess";

describe("getRequiredModuleForAdminPath", () => {
  it("returns null for non-admin paths", () => {
    expect(getRequiredModuleForAdminPath("/dashboard")).toBeNull();
  });

  it("falls back to the dashboard module for an unmapped admin path", () => {
    expect(getRequiredModuleForAdminPath("/admin/some-unmapped-page")).toBe("dashboard");
  });

  it("maps the 3PGS packing-material catalogue to the inventory module, not the dashboard fallback", () => {
    expect(getRequiredModuleForAdminPath("/admin/3pgs-packing-material")).toBe("inventory");
    expect(getRequiredModuleForAdminPath("/admin/3pgs-packing-material/anything")).toBe("inventory");
  });

  it("prefers the longer, more specific prefix over a shorter overlapping one", () => {
    expect(getRequiredModuleForAdminPath("/admin/ready-goods")).toBe("inventory");
    expect(getRequiredModuleForAdminPath("/admin/inventory-risk-board")).toBe("inventory");
  });
});
