import { sendWhatsAppMessage } from "@/utils/whatsapp";
import { captureCrmManualAction, insertGovernedCapture, type CrmActionCaptureDeps } from "./crmActionCaptureClient";
import type {
  CrmActionCaptureResult,
  CrmEmailIntentInput,
  CrmManualActionInput,
  CrmWhatsAppProviderInput,
} from "./crmActionCaptureTypes";
import {
  captureFailure,
  validateEmailIntentInput,
  validateWhatsAppProviderInput,
} from "./crmActionCaptureValidation";

/** Capture a CRM note with actor, company, timestamp and explicit provenance. */
export async function captureCrmNote(
  input: Omit<CrmManualActionInput, "channel">,
  deps?: CrmActionCaptureDeps,
): Promise<CrmActionCaptureResult> {
  return captureCrmManualAction({ ...input, channel: "note" }, deps);
}

/** Capture a dated promise/commitment — follow-up date is mandatory. */
export async function captureCrmPromise(
  input: Omit<CrmManualActionInput, "channel"> & { followUpDate: string },
  deps?: CrmActionCaptureDeps,
): Promise<CrmActionCaptureResult> {
  return captureCrmManualAction({ ...input, channel: "promise" }, deps);
}

/**
 * Record email intent only — no provider send, no delivered claim.
 * Fails closed on actual email dispatch until Core email authority is configured.
 */
export async function captureEmailIntent(
  input: CrmEmailIntentInput,
  deps?: CrmActionCaptureDeps,
): Promise<CrmActionCaptureResult> {
  const validationError = validateEmailIntentInput(input);
  if (validationError) return validationError;

  const notes = [
    input.subject?.trim() ? `Subject: ${input.subject.trim()}` : null,
    input.body?.trim() || null,
  ]
    .filter(Boolean)
    .join("\n");

  const idempotencyKey = input.idempotencyKey?.trim() || crypto.randomUUID();
  return insertGovernedCapture(
    {
      input: {
        companyId: input.companyId,
        executiveId: input.executiveId,
        channel: "email",
        notes,
        outcome: null,
        authorizedCompanyIds: input.authorizedCompanyIds,
      },
      deliveryState: "intent_only",
      source: "intent_only",
      idempotencyKey,
    },
    deps,
  );
}

/**
 * Route WhatsApp outbound through existing `send-whatsapp` Core authority.
 * Provider result (delivered/failed) is written by the edge function — never invented here.
 */
export async function captureWhatsAppProviderSend(
  input: CrmWhatsAppProviderInput,
): Promise<CrmActionCaptureResult> {
  const validationError = validateWhatsAppProviderInput(input);
  if (validationError) return validationError;

  const idempotencyKey = input.idempotencyKey?.trim() || crypto.randomUUID();
  const send = input.sendProvider ?? sendWhatsAppMessage;

  const result = await send({
    to: input.to,
    message: input.message,
    companyId: input.companyId,
    orderId: input.orderId,
  });

  if (!result.success) {
    return captureFailure(
      "provider_unavailable",
      result.error ?? "WhatsApp provider send failed; no delivered state recorded.",
    );
  }

  // Durable CRM row is written by send-whatsapp edge when company_id is present.
  // Return success with intent key for caller correlation — record id resolved via idempotency on manual path only.
  return {
    ok: true,
    recordId: "provider:send-whatsapp",
    idempotencyKey,
    deliveryState: "pending_provider",
    deduplicated: false,
  };
}
