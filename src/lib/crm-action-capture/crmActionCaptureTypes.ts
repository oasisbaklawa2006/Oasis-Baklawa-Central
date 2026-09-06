/**
 * Point 62 — governed CRM action capture (calls / WhatsApp / email / notes / promises).
 * Writes durable rows to Core `client_interactions`; Point 61 reads them back.
 */

import type { CrmCommunicationChannel } from "@/lib/crm-communication-history/crmCommunicationHistoryTypes";

/** Manual channels captured directly to client_interactions. */
export type CrmManualCaptureChannel = "call" | "visit" | "note" | "promise";

/** Provider-routed channels — intent/result separation enforced. */
export type CrmProviderCaptureChannel = "whatsapp" | "email";

export type CrmActionCaptureChannel = CrmManualCaptureChannel | CrmProviderCaptureChannel;

export type CrmActionCaptureSource =
  | "central_customer360"
  | "central_sales_dashboard"
  | "central_sales_interactions"
  | "central_sales_crm_lite";

export type CrmActionCapturePhase = "intent" | "result";

export type CrmActionCaptureOutcome =
  | "recorded"
  | "logged_manual"
  | "intent_recorded"
  | "provider_unavailable"
  | "delivered"
  | "failed";

export type CrmActionCaptureActor = {
  userId: string;
  role: string | null;
  isInternalStaff: boolean;
};

export type CrmActionCaptureCompanyBinding = {
  companyId: string;
  accountManagerId: string | null;
};

export type CrmManualActionInput = {
  companyId: string;
  channel: CrmManualCaptureChannel;
  notes: string;
  outcome?: string | null;
  followUpDate?: string | null;
  source: CrmActionCaptureSource;
  idempotencyKey: string;
};

export type CrmWhatsAppManualLogInput = {
  companyId: string;
  notes: string;
  outcome?: string | null;
  followUpDate?: string | null;
  source: CrmActionCaptureSource;
  idempotencyKey: string;
};

export type CrmEmailIntentInput = {
  companyId: string;
  subject: string;
  bodyPreview: string;
  recipientEmail?: string | null;
  source: CrmActionCaptureSource;
  idempotencyKey: string;
};

export type CrmWhatsAppProviderSendInput = {
  companyId: string;
  to: string;
  message: string;
  orderId?: string | null;
  source: CrmActionCaptureSource;
  idempotencyKey: string;
};

export type CrmActionCaptureResult = {
  recordId: string;
  companyId: string;
  channel: CrmActionCaptureChannel;
  phase: CrmActionCapturePhase;
  outcome: CrmActionCaptureOutcome;
  interactionType: string;
  idempotencyKey: string;
  source: CrmActionCaptureSource;
  capturedAt: string;
  idempotentReplay: boolean;
  providerInvoked?: boolean;
  providerSuccess?: boolean;
  providerError?: string | null;
};

export type CrmActionCaptureAuthorizationFailure =
  | "missing_actor"
  | "invalid_company_id"
  | "company_not_found"
  | "cross_company_denied"
  | "roster_binding_denied";

export class CrmActionCaptureError extends Error {
  readonly code: CrmActionCaptureAuthorizationFailure | "validation" | "persist_failed" | "provider_failed";

  constructor(
    code: CrmActionCaptureAuthorizationFailure | "validation" | "persist_failed" | "provider_failed",
    message: string,
  ) {
    super(message);
    this.name = "CrmActionCaptureError";
    this.code = code;
  }
}

export function captureChannelToCommunicationChannel(
  channel: CrmActionCaptureChannel,
): CrmCommunicationChannel {
  return channel;
}
