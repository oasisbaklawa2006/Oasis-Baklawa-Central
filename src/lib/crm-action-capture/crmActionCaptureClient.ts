import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildCapturedNotes,
  buildPoint62ProvenanceMarker,
  extractIdempotencyKeyFromNotes,
} from "./crmActionCaptureProvenance";
import type {
  CrmActionCaptureActor,
  CrmActionCaptureChannel,
  CrmActionCaptureCompanyBinding,
  CrmActionCaptureOutcome,
  CrmActionCapturePhase,
  CrmActionCaptureResult,
  CrmActionCaptureSource,
  CrmEmailIntentInput,
  CrmManualActionInput,
  CrmWhatsAppManualLogInput,
} from "./crmActionCaptureTypes";
import {
  assertCrmActionCaptureAuthorization,
  assertIdempotencyKey,
  assertNonEmptyNotes,
} from "./crmActionCaptureValidation";

type InteractionRow = {
  id: string;
  company_id: string | null;
  executive_id: string | null;
  interaction_type: string | null;
  notes: string | null;
  outcome: string | null;
  follow_up_date: string | null;
  created_at: string | null;
};

export type CrmActionCapturePersistence = {
  resolveCompanyBinding(companyId: string): Promise<CrmActionCaptureCompanyBinding | null>;
  findByIdempotencyKey(companyId: string, idempotencyKey: string): Promise<InteractionRow | null>;
  insertInteraction(row: {
    company_id: string;
    executive_id: string;
    interaction_type: string;
    notes: string;
    outcome: string | null;
    follow_up_date: string | null;
  }): Promise<InteractionRow>;
};

export function createSupabaseCrmActionCapturePersistence(
  client: SupabaseClient,
): CrmActionCapturePersistence {
  return {
    async resolveCompanyBinding(companyId) {
      const { data, error } = await client
        .from("companies")
        .select("id, account_manager_id")
        .eq("id", companyId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data?.id) return null;
      return {
        companyId: data.id,
        accountManagerId: data.account_manager_id,
      };
    },

    async findByIdempotencyKey(companyId, idempotencyKey) {
      const marker = `:idem:${idempotencyKey}]`;
      const { data, error } = await client
        .from("client_interactions")
        .select("id, company_id, executive_id, interaction_type, notes, outcome, follow_up_date, created_at")
        .eq("company_id", companyId)
        .ilike("notes", `%${marker}%`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data as InteractionRow | null) ?? null;
    },

    async insertInteraction(row) {
      const { data, error } = await client
        .from("client_interactions")
        .insert(row)
        .select("id, company_id, executive_id, interaction_type, notes, outcome, follow_up_date, created_at")
        .single();
      if (error) throw new Error(error.message);
      return data as InteractionRow;
    },
  };
}

function mapPersistedRowToResult(params: {
  row: InteractionRow;
  channel: CrmActionCaptureChannel;
  phase: CrmActionCapturePhase;
  outcome: CrmActionCaptureOutcome;
  source: CrmActionCaptureSource;
  idempotencyKey: string;
  idempotentReplay: boolean;
  providerInvoked?: boolean;
  providerSuccess?: boolean;
  providerError?: string | null;
}): CrmActionCaptureResult {
  return {
    recordId: params.row.id,
    companyId: params.row.company_id ?? "",
    channel: params.channel,
    phase: params.phase,
    outcome: params.outcome,
    interactionType: params.row.interaction_type ?? params.channel,
    idempotencyKey: params.idempotencyKey,
    source: params.source,
    capturedAt: params.row.created_at ?? new Date().toISOString(),
    idempotentReplay: params.idempotentReplay,
    providerInvoked: params.providerInvoked,
    providerSuccess: params.providerSuccess,
    providerError: params.providerError,
  };
}

async function captureManualInteraction(
  persistence: CrmActionCapturePersistence,
  actor: CrmActionCaptureActor,
  input: {
    companyId: string;
    channel: CrmActionCaptureChannel;
    notes: string;
    outcome: CrmActionCaptureOutcome;
    followUpDate?: string | null;
    source: CrmActionCaptureSource;
    idempotencyKey: string;
    interactionType: string;
  },
): Promise<CrmActionCaptureResult> {
  assertIdempotencyKey(input.idempotencyKey);
  assertNonEmptyNotes(input.notes);

  const binding = await persistence.resolveCompanyBinding(input.companyId);
  assertCrmActionCaptureAuthorization(actor, input.companyId, binding!);

  const existing = await persistence.findByIdempotencyKey(input.companyId, input.idempotencyKey);
  if (existing) {
    const existingKey = extractIdempotencyKeyFromNotes(existing.notes);
    if (existingKey === input.idempotencyKey) {
      return mapPersistedRowToResult({
        row: existing,
        channel: input.channel,
        phase: "result",
        outcome: (existing.outcome as CrmActionCaptureOutcome) ?? input.outcome,
        source: input.source,
        idempotencyKey: input.idempotencyKey,
        idempotentReplay: true,
      });
    }
  }

  const marker = buildPoint62ProvenanceMarker({
    source: input.source,
    channel: input.channel,
    phase: "result",
    idempotencyKey: input.idempotencyKey,
  });

  try {
    const row = await persistence.insertInteraction({
      company_id: input.companyId,
      executive_id: actor.userId,
      interaction_type: input.interactionType,
      notes: buildCapturedNotes(marker, input.notes),
      outcome: input.outcome,
      follow_up_date: input.followUpDate ?? null,
    });

    return mapPersistedRowToResult({
      row,
      channel: input.channel,
      phase: "result",
      outcome: input.outcome,
      source: input.source,
      idempotencyKey: input.idempotencyKey,
      idempotentReplay: false,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Persist failed";
    throw new (await import("./crmActionCaptureTypes")).CrmActionCaptureError(
      "persist_failed",
      message,
    );
  }
}

export async function captureCrmManualAction(
  persistence: CrmActionCapturePersistence,
  actor: CrmActionCaptureActor,
  input: CrmManualActionInput,
): Promise<CrmActionCaptureResult> {
  const interactionType = input.channel === "promise" ? "promise" : input.channel;
  const outcome: CrmActionCaptureOutcome =
    input.channel === "promise" ? "intent_recorded" : "recorded";

  return captureManualInteraction(persistence, actor, {
    companyId: input.companyId,
    channel: input.channel,
    notes: input.notes,
    outcome: input.outcome ? (input.outcome as CrmActionCaptureOutcome) : outcome,
    followUpDate: input.followUpDate ?? null,
    source: input.source,
    idempotencyKey: input.idempotencyKey,
    interactionType,
  });
}

export async function captureCrmWhatsAppManualLog(
  persistence: CrmActionCapturePersistence,
  actor: CrmActionCaptureActor,
  input: CrmWhatsAppManualLogInput,
): Promise<CrmActionCaptureResult> {
  return captureManualInteraction(persistence, actor, {
    companyId: input.companyId,
    channel: "whatsapp",
    notes: input.notes,
    outcome: "logged_manual",
    followUpDate: input.followUpDate ?? null,
    source: input.source,
    idempotencyKey: input.idempotencyKey,
    interactionType: "whatsapp",
  });
}

export async function captureCrmEmailIntent(
  persistence: CrmActionCapturePersistence,
  actor: CrmActionCaptureActor,
  input: CrmEmailIntentInput,
): Promise<CrmActionCaptureResult> {
  const notes = [
    `Subject: ${input.subject.trim()}`,
    input.recipientEmail ? `To: ${input.recipientEmail.trim()}` : "To: (not specified)",
    "",
    input.bodyPreview.trim(),
    "",
    "Email provider is not configured for company-scoped CRM capture. Intent recorded only.",
  ].join("\n");

  return captureManualInteraction(persistence, actor, {
    companyId: input.companyId,
    channel: "email",
    notes,
    outcome: "intent_recorded",
    followUpDate: null,
    source: input.source,
    idempotencyKey: input.idempotencyKey,
    interactionType: "email",
  });
}

export function newCrmActionIdempotencyKey(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 10);
  const time = Date.now().toString(36);
  return `${prefix}-${time}-${random}`;
}
