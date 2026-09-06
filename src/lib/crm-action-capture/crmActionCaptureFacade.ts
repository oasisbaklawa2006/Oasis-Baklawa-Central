import { supabase } from "@/integrations/supabase/client";
import {
  captureCrmEmailIntent,
  captureCrmManualAction,
  captureCrmWhatsAppManualLog,
  createSupabaseCrmActionCapturePersistence,
  newCrmActionIdempotencyKey,
  type CrmActionCapturePersistence,
} from "./crmActionCaptureClient";
import type {
  CrmActionCaptureActor,
  CrmActionCaptureResult,
  CrmEmailIntentInput,
  CrmManualActionInput,
  CrmWhatsAppManualLogInput,
  CrmWhatsAppProviderSendInput,
} from "./crmActionCaptureTypes";
import { CrmActionCaptureError } from "./crmActionCaptureTypes";
import { buildPoint62ProvenanceMarker, buildCapturedNotes } from "./crmActionCaptureProvenance";
import {
  assertCrmActionCaptureAuthorization,
  assertIdempotencyKey,
  assertNonEmptyNotes,
} from "./crmActionCaptureValidation";

const persistence = createSupabaseCrmActionCapturePersistence(supabase);

export type CrmActionCaptureFacade = {
  captureManualAction(
    actor: CrmActionCaptureActor,
    input: CrmManualActionInput,
  ): Promise<CrmActionCaptureResult>;
  captureWhatsAppManualLog(
    actor: CrmActionCaptureActor,
    input: CrmWhatsAppManualLogInput,
  ): Promise<CrmActionCaptureResult>;
  captureEmailIntent(
    actor: CrmActionCaptureActor,
    input: CrmEmailIntentInput,
  ): Promise<CrmActionCaptureResult>;
  captureWhatsAppProviderSend(
    actor: CrmActionCaptureActor,
    input: CrmWhatsAppProviderSendInput,
  ): Promise<CrmActionCaptureResult>;
};

async function recordWhatsAppSendIntent(
  store: CrmActionCapturePersistence,
  actor: CrmActionCaptureActor,
  input: CrmWhatsAppProviderSendInput,
): Promise<void> {
  const binding = await store.resolveCompanyBinding(input.companyId);
  assertCrmActionCaptureAuthorization(actor, input.companyId, binding!);
  assertIdempotencyKey(input.idempotencyKey);
  assertNonEmptyNotes(input.message);

  const existing = await store.findByIdempotencyKey(input.companyId, input.idempotencyKey);
  if (existing) return;

  const marker = buildPoint62ProvenanceMarker({
    source: input.source,
    channel: "whatsapp",
    phase: "intent",
    idempotencyKey: input.idempotencyKey,
  });

  await store.insertInteraction({
    company_id: input.companyId,
    executive_id: actor.userId,
    interaction_type: "whatsapp",
    notes: buildCapturedNotes(
      marker,
      `Provider send intent to ${input.to}\n\n${input.message}`,
    ),
    outcome: "intent_recorded",
    follow_up_date: null,
  });
}

export async function captureWhatsAppProviderSend(
  store: CrmActionCapturePersistence,
  actor: CrmActionCaptureActor,
  input: CrmWhatsAppProviderSendInput,
  deps?: {
    invokeSendWhatsApp?: (body: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
  },
): Promise<CrmActionCaptureResult> {
  await recordWhatsAppSendIntent(store, actor, input);

  const invoke =
    deps?.invokeSendWhatsApp ??
    ((body: Record<string, unknown>) =>
      supabase.functions.invoke("send-whatsapp", { body }));

  const { data, error } = await invoke({
    to: input.to,
    message: input.message,
    company_id: input.companyId,
    order_id: input.orderId ?? null,
  });

  if (error) {
    return {
      recordId: input.idempotencyKey,
      companyId: input.companyId,
      channel: "whatsapp",
      phase: "result",
      outcome: "failed",
      interactionType: "whatsapp",
      idempotencyKey: input.idempotencyKey,
      source: input.source,
      capturedAt: new Date().toISOString(),
      idempotentReplay: false,
      providerInvoked: true,
      providerSuccess: false,
      providerError: error.message,
    };
  }

  const providerSuccess = Boolean((data as { success?: boolean } | null)?.success);
  const providerError =
    providerSuccess ? null : String((data as { error?: string } | null)?.error ?? "Provider send failed");

  return {
    recordId: input.idempotencyKey,
    companyId: input.companyId,
    channel: "whatsapp",
    phase: "result",
    outcome: providerSuccess ? "delivered" : "failed",
    interactionType: "whatsapp",
    idempotencyKey: input.idempotencyKey,
    source: input.source,
    capturedAt: new Date().toISOString(),
    idempotentReplay: false,
    providerInvoked: true,
    providerSuccess,
    providerError,
  };
}

export const crmActionCapture: CrmActionCaptureFacade = {
  captureManualAction: (actor, input) => captureCrmManualAction(persistence, actor, input),
  captureWhatsAppManualLog: (actor, input) => captureCrmWhatsAppManualLog(persistence, actor, input),
  captureEmailIntent: (actor, input) => captureCrmEmailIntent(persistence, actor, input),
  captureWhatsAppProviderSend: (actor, input) => captureWhatsAppProviderSend(persistence, actor, input),
};

export { newCrmActionIdempotencyKey };

export function toCrmActionCaptureActor(params: {
  userId: string | undefined;
  role: string | null | undefined;
  isInternalStaff?: boolean;
}): CrmActionCaptureActor {
  return {
    userId: params.userId ?? "",
    role: params.role ?? null,
    isInternalStaff: params.isInternalStaff ?? false,
  };
}

export function formatCrmActionCaptureError(error: unknown): string {
  if (error instanceof CrmActionCaptureError) return error.message;
  if (error instanceof Error) return error.message;
  return "Action capture failed.";
}
