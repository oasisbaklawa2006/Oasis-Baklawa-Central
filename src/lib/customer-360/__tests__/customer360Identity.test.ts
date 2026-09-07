import { describe, expect, it } from "vitest";
import {
  assertCustomer360CompanyAccess,
  customer360RouteForCompany,
  normalizeCompanyId,
  Customer360IdentityError,
} from "../customer360Identity";

const VALID_UUID = "a1b2c3d4-e5f6-4789-a012-3456789abcde";

describe("customer360Identity", () => {
  it("normalizes valid company UUIDs", () => {
    expect(normalizeCompanyId(VALID_UUID)).toBe(VALID_UUID.toLowerCase());
  });

  it("rejects missing or malformed company identity", () => {
    expect(() => normalizeCompanyId("")).toThrow(Customer360IdentityError);
    expect(() => normalizeCompanyId("not-a-uuid")).toThrow(Customer360IdentityError);
  });

  it("builds canonical Customer 360 route", () => {
    expect(customer360RouteForCompany(VALID_UUID)).toBe(`/admin/clients/${VALID_UUID.toLowerCase()}`);
  });

  it("fail-closes cross-company storefront access", () => {
    expect(() =>
      assertCustomer360CompanyAccess(VALID_UUID, {
        viewerCompanyId: "00000000-0000-4000-8000-000000000001",
        isStorefrontViewer: true,
      }),
    ).toThrow(Customer360IdentityError);

    expect(() =>
      assertCustomer360CompanyAccess(VALID_UUID, {
        viewerCompanyId: VALID_UUID,
        isStorefrontViewer: true,
      }),
    ).not.toThrow();
  });

  it("allows staff viewers without company binding", () => {
    expect(() =>
      assertCustomer360CompanyAccess(VALID_UUID, {
        viewerCompanyId: null,
        isStorefrontViewer: false,
      }),
    ).not.toThrow();
  });
});
