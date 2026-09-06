import { normalizeCompanyId } from "@/lib/customer-360/customer360Identity";
import type {
  CrmActionCaptureActor,
  CrmActionCaptureAuthorizationFailure,
  CrmActionCaptureCompanyBinding,
  CrmActionCaptureError,
} from "./crmActionCaptureTypes";
import { CrmActionCaptureError as CaptureError } from "./crmActionCaptureTypes";

const SALES_EXECUTIVE_ROLES = new Set(["SALES_EXECUTIVE", "sales_executive"]);

export function isSalesExecutiveRole(role: string | null | undefined): boolean {
  return SALES_EXECUTIVE_ROLES.has((role ?? "").trim());
}

export function assertCrmActionCaptureActor(actor: CrmActionCaptureActor | null | undefined): void {
  if (!actor?.userId?.trim()) {
    throw new CaptureError("missing_actor", "Actor identity is required for governed action capture.");
  }
}

export function assertCrmActionCaptureCompanyBinding(
  rawCompanyId: string,
  binding: CrmActionCaptureCompanyBinding | null | undefined,
): string {
  const companyId = normalizeCompanyId(rawCompanyId);
  if (!binding) {
    throw new CaptureError("company_not_found", "Company binding could not be resolved.");
  }
  if (binding.companyId.toLowerCase() !== companyId.toLowerCase()) {
    throw new CaptureError("cross_company_denied", "Company binding does not match the capture target.");
  }
  return companyId;
}

export function assertCrmActionCaptureAuthorization(
  actor: CrmActionCaptureActor,
  companyId: string,
  binding: CrmActionCaptureCompanyBinding,
): void {
  assertCrmActionCaptureActor(actor);
  assertCrmActionCaptureCompanyBinding(companyId, binding);

  if (actor.isInternalStaff && !isSalesExecutiveRole(actor.role)) {
    return;
  }

  if (isSalesExecutiveRole(actor.role)) {
    if (!binding.accountManagerId || binding.accountManagerId !== actor.userId) {
      throw new CaptureError(
        "roster_binding_denied",
        "Sales executives may only capture actions for roster-assigned companies.",
      );
    }
    return;
  }

  if (actor.isInternalStaff) {
    return;
  }

  throw new CaptureError(
    "cross_company_denied",
    "Actor is not authorized to capture CRM actions for this company.",
  );
}

export function assertNonEmptyNotes(notes: string): void {
  if (!notes.trim()) {
    throw new CaptureError("validation", "Notes are required for governed action capture.");
  }
}

export function assertIdempotencyKey(idempotencyKey: string): void {
  if (!idempotencyKey.trim()) {
    throw new CaptureError("validation", "Idempotency key is required.");
  }
  if (idempotencyKey.length > 120) {
    throw new CaptureError("validation", "Idempotency key exceeds maximum length.");
  }
}

export function authorizationFailureMessage(
  code: CrmActionCaptureAuthorizationFailure,
): string {
  switch (code) {
    case "missing_actor":
      return "Actor identity is required.";
    case "invalid_company_id":
      return "Company identity is invalid.";
    case "company_not_found":
      return "Company could not be resolved.";
    case "cross_company_denied":
      return "Cross-company capture is not authorized.";
    case "roster_binding_denied":
      return "Company is outside the actor roster.";
    default:
      return "Capture authorization failed.";
  }
}

export type { CrmActionCaptureError };
