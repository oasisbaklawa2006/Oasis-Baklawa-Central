import type { CrmActionCaptureResult } from "./crmActionCaptureTypes";
import { captureFailure } from "./crmActionCaptureValidation";

const SALES_EXECUTIVE_ROLES = new Set(["SALES_EXECUTIVE", "sales_executive"]);

export type CrmActionCompanyBinding = {
  companyId: string;
  accountManagerId: string | null;
};

export function isSalesExecutiveRole(role: string | null | undefined): boolean {
  return SALES_EXECUTIVE_ROLES.has((role ?? "").trim());
}

/** Fail-closed actor/company authorization using Core company binding. */
export function validateActorCompanyAuthorization(params: {
  executiveId: string;
  companyId: string;
  binding: CrmActionCompanyBinding | null;
  actorRole?: string | null;
  isInternalStaff?: boolean;
}): CrmActionCaptureResult | null {
  if (!params.executiveId.trim()) {
    return captureFailure("missing_actor", "Actor (executive_id) is required for governed capture.");
  }

  if (!params.binding) {
    return captureFailure("unauthorized_company", "Company binding could not be resolved.");
  }

  if (params.binding.companyId.toLowerCase() !== params.companyId.toLowerCase()) {
    return captureFailure("unauthorized_company", "Company binding does not match the capture target.");
  }

  if (params.isInternalStaff && !isSalesExecutiveRole(params.actorRole)) {
    return null;
  }

  if (isSalesExecutiveRole(params.actorRole)) {
    if (!params.binding.accountManagerId || params.binding.accountManagerId !== params.executiveId) {
      return captureFailure("unauthorized_company", "Company is outside the actor roster.");
    }
    return null;
  }

  if (params.isInternalStaff) {
    return null;
  }

  return captureFailure(
    "unauthorized_company",
    "Actor is not authorized to capture CRM actions for this company.",
  );
}
