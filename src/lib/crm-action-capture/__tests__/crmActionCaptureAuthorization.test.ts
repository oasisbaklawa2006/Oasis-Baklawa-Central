import { describe, expect, it } from "vitest";
import {
  isSalesExecutiveRole,
  validateActorCompanyAuthorization,
} from "../crmActionCaptureAuthorization";

const COMPANY_ID = "a1b2c3d4-e5f6-4789-a012-3456789abcde";
const EXEC_ID = "e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e1e1";

describe("crmActionCaptureAuthorization", () => {
  it("allows roster-bound sales executives", () => {
    expect(
      validateActorCompanyAuthorization({
        executiveId: EXEC_ID,
        companyId: COMPANY_ID,
        binding: { companyId: COMPANY_ID, accountManagerId: EXEC_ID },
        actorRole: "SALES_EXECUTIVE",
      }),
    ).toBeNull();
  });

  it("denies sales executives outside roster binding", () => {
    const result = validateActorCompanyAuthorization({
      executiveId: EXEC_ID,
      companyId: COMPANY_ID,
      binding: { companyId: COMPANY_ID, accountManagerId: "other-exec" },
      actorRole: "SALES_EXECUTIVE",
    });
    expect(result).toMatchObject({ ok: false, failure: "unauthorized_company" });
  });

  it("allows internal staff admins without roster binding", () => {
    expect(
      validateActorCompanyAuthorization({
        executiveId: "admin-1",
        companyId: COMPANY_ID,
        binding: { companyId: COMPANY_ID, accountManagerId: null },
        actorRole: "ADMIN",
        isInternalStaff: true,
      }),
    ).toBeNull();
  });

  it("detects sales executive roles", () => {
    expect(isSalesExecutiveRole("SALES_EXECUTIVE")).toBe(true);
    expect(isSalesExecutiveRole("ADMIN")).toBe(false);
  });
});
