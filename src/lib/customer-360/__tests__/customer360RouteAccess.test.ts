import { describe, expect, it } from "vitest";
import { getRequiredModuleForAdminPath } from "@/lib/appverse/routeAccess";
import { customer360RouteForCompany, salesCustomer360RouteForCompany } from "@/lib/customer-360/customer360Identity";

const VALID_UUID = "a1b2c3d4-e5f6-4789-a012-3456789abcde";

describe("Customer 360 route access", () => {
  it("maps Customer 360 detail routes to clients module", () => {
    expect(getRequiredModuleForAdminPath(customer360RouteForCompany(VALID_UUID))).toBe("clients");
  });

  it("exposes sales-scoped Customer 360 outside admin module guard", () => {
    expect(salesCustomer360RouteForCompany(VALID_UUID)).toBe(`/sales/clients/${VALID_UUID.toLowerCase()}`);
    expect(getRequiredModuleForAdminPath(salesCustomer360RouteForCompany(VALID_UUID))).toBeNull();
  });
});
