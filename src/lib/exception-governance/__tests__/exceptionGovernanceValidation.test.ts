import { describe, expect, it } from "vitest";
import {
  validateCanonicalBinding,
  validateDeclarationInput,
  validateDepartmentIsolation,
  validateQuantityIntegrity,
  validateReleaseInput,
} from "../exceptionGovernanceValidation";
import { ExceptionGovernanceError } from "../exceptionGovernanceTypes";

const ctx = {
  correlationId: "corr-1",
  actorUserId: "user-1",
  actorRole: "HOD_ARABIC",
  actorDepartment: "ARABIC_SWEETS",
  reason: "Material shortage on line 2",
};

describe("exceptionGovernanceValidation", () => {
  it("requires reservation binding for shortage", () => {
    expect(() =>
      validateCanonicalBinding("shortage", { subsystem: "RGS" }),
    ).toThrow(ExceptionGovernanceError);
  });

  it("enforces quantity integrity tolerance", () => {
    expect(() =>
      validateQuantityIntegrity({ expectedQty: 100, actualQty: 85, wastedQty: 30 }),
    ).toThrow(/tolerance/i);
  });

  it("validates declaration input with canonical binding", () => {
    validateDeclarationInput(
      {
        category: "blocker",
        binding: { subsystem: "PRODUCTION", jobId: "job-1", department: "ARABIC_SWEETS" },
      },
      ctx,
    );
  });

  it("enforces department isolation for HOD roles", () => {
    expect(() =>
      validateDepartmentIsolation("ARABIC_SWEETS", "CHOCOLATES_CONFECTIONERY", "HOD_ARABIC"),
    ).toThrow(ExceptionGovernanceError);
  });

  it("requires independent authorizer on release", () => {
    expect(() =>
      validateReleaseInput(
        {
          category: "quality_hold",
          binding: { subsystem: "3PGS", productId: "p1", sku: "SKU-1" },
          targetId: "ex-1",
          resolutionNotes: "QC passed",
        },
        { ...ctx, releaseAuthorizerRole: undefined },
      ),
    ).toThrow(/authorizer/i);
  });
});
