import { describe, expect, it } from "vitest";
import {
  assertCrmActionCaptureAuthorization,
  assertIdempotencyKey,
  isSalesExecutiveRole,
} from "../crmActionCaptureValidation";
import { CrmActionCaptureError } from "../crmActionCaptureTypes";

const actor = {
  userId: "exec-1",
  role: "SALES_EXECUTIVE",
  isInternalStaff: false,
};

const binding = {
  companyId: "11111111-1111-4111-8111-111111111111",
  accountManagerId: "exec-1",
};

describe("crmActionCaptureValidation", () => {
  it("allows roster-bound sales executives", () => {
    expect(() =>
      assertCrmActionCaptureAuthorization(actor, binding.companyId, binding),
    ).not.toThrow();
  });

  it("denies cross-company roster binding", () => {
    expect(() =>
      assertCrmActionCaptureAuthorization(actor, binding.companyId, {
        ...binding,
        accountManagerId: "other-exec",
      }),
    ).toThrow(CrmActionCaptureError);
  });

  it("allows internal staff admins without roster binding", () => {
    expect(() =>
      assertCrmActionCaptureAuthorization(
        { userId: "admin-1", role: "ADMIN", isInternalStaff: true },
        binding.companyId,
        { ...binding, accountManagerId: null },
      ),
    ).not.toThrow();
  });

  it("requires idempotency keys", () => {
    expect(() => assertIdempotencyKey("")).toThrow(CrmActionCaptureError);
    expect(() => assertIdempotencyKey("idem-ok")).not.toThrow();
  });

  it("detects sales executive roles", () => {
    expect(isSalesExecutiveRole("SALES_EXECUTIVE")).toBe(true);
    expect(isSalesExecutiveRole("ADMIN")).toBe(false);
  });
});
