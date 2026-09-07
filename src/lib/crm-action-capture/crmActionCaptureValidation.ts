import { normalizeCompanyId } from "@/lib/customer-360/customer360Identity";
import { Customer360IdentityError } from "@/lib/customer-360/customer360Identity";
import type {
  CrmActionCaptureFailure,
  CrmActionCaptureResult,
  CrmEmailIntentInput,
  CrmManualActionInput,
  CrmWhatsAppProviderInput,
} from "./crmActionCaptureTypes";

export function captureFailure(
  failure: CrmActionCaptureFailure,
  message: string,
): CrmActionCaptureResult {
  return { ok: false, failure, message };
}

export function assertValidCompanyId(raw: string): string {
  try {
    return normalizeCompanyId(raw);
  } catch (error) {
    if (error instanceof Customer360IdentityError) {
      throw error;
    }
    throw new Customer360IdentityError("invalid_company_id", "Customer identity must be a valid company UUID.");
  }
}

export function validateManualActionInput(input: CrmManualActionInput): CrmActionCaptureResult | null {
  try {
    assertValidCompanyId(input.companyId);
  } catch {
    return captureFailure("invalid_company_id", "A valid company identity is required.");
  }

  if (!input.executiveId?.trim()) {
    return captureFailure("missing_actor", "Actor (executive_id) is required for governed capture.");
  }

  if (!input.notes?.trim()) {
    return captureFailure("missing_notes", "Notes cannot be empty.");
  }

  if (input.channel === "promise" && !input.followUpDate?.trim()) {
    return captureFailure("missing_follow_up_date", "Promises require an explicit follow-up date.");
  }

  if (input.channel === "email") {
    return captureFailure(
      "provider_unavailable",
      "Email provider authority is not configured; use captureEmailIntent for intent-only recording.",
    );
  }

  if (input.authorizedCompanyIds && input.authorizedCompanyIds.length > 0) {
    const normalized = assertValidCompanyId(input.companyId);
    const allowed = new Set(input.authorizedCompanyIds.map((id) => id.toLowerCase()));
    if (!allowed.has(normalized)) {
      return captureFailure("unauthorized_company", "Company is outside the authorized roster scope.");
    }
  }

  return null;
}

export function validateEmailIntentInput(input: CrmEmailIntentInput): CrmActionCaptureResult | null {
  try {
    assertValidCompanyId(input.companyId);
  } catch {
    return captureFailure("invalid_company_id", "A valid company identity is required.");
  }

  if (!input.executiveId?.trim()) {
    return captureFailure("missing_actor", "Actor (executive_id) is required for governed capture.");
  }

  if (!input.subject?.trim() && !input.body?.trim()) {
    return captureFailure("missing_notes", "Email intent requires a subject or body.");
  }

  if (input.authorizedCompanyIds && input.authorizedCompanyIds.length > 0) {
    const normalized = assertValidCompanyId(input.companyId);
    const allowed = new Set(input.authorizedCompanyIds.map((id) => id.toLowerCase()));
    if (!allowed.has(normalized)) {
      return captureFailure("unauthorized_company", "Company is outside the authorized roster scope.");
    }
  }

  return null;
}

export function validateWhatsAppProviderInput(input: CrmWhatsAppProviderInput): CrmActionCaptureResult | null {
  try {
    assertValidCompanyId(input.companyId);
  } catch {
    return captureFailure("invalid_company_id", "A valid company identity is required.");
  }

  if (!input.executiveId?.trim()) {
    return captureFailure("missing_actor", "Actor (executive_id) is required for governed capture.");
  }

  if (!input.message?.trim()) {
    return captureFailure("missing_notes", "Message body is required.");
  }

  if (!input.to?.trim()) {
    return captureFailure("provider_unavailable", "Recipient phone is required for WhatsApp provider capture.");
  }

  if (input.authorizedCompanyIds && input.authorizedCompanyIds.length > 0) {
    const normalized = assertValidCompanyId(input.companyId);
    const allowed = new Set(input.authorizedCompanyIds.map((id) => id.toLowerCase()));
    if (!allowed.has(normalized)) {
      return captureFailure("unauthorized_company", "Company is outside the authorized roster scope.");
    }
  }

  return null;
}

export function mapInteractionTypeForChannel(channel: CrmManualActionInput["channel"]): string {
  return channel;
}
