import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import {
  formatCaptureProvenance,
  idempotencyMarker,
  parseCaptureProvenance,
} from "./crmActionCaptureProvenance";
import {
  assertValidCompanyId,
  captureFailure,
  mapInteractionTypeForChannel,
  validateManualActionInput,
} from "./crmActionCaptureValidation";
import type {
  CrmActionCaptureResult,
  CrmActionCaptureRow,
  CrmActionDeliveryState,
  CrmActionSource,
  CrmManualActionInput,
} from "./crmActionCaptureTypes";

type ClientInteractionInsert = Database["public"]["Tables"]["client_interactions"]["Insert"];
type ClientInteractionRow = Database["public"]["Tables"]["client_interactions"]["Row"];

export type CrmActionCaptureDeps = {
  insertInteraction: (row: ClientInteractionInsert) => Promise<{ data: ClientInteractionRow | null; error: { message: string } | null }>;
  findByIdempotency: (companyId: string, idempotencyKey: string) => Promise<ClientInteractionRow | null>;
};

function defaultDeps(): CrmActionCaptureDeps {
  return {
    async insertInteraction(row) {
      const { data, error } = await supabase
        .from("client_interactions")
        .insert(row)
        .select("id, company_id, executive_id, interaction_type, notes, outcome, follow_up_date, created_at")
        .single();
      return { data, error };
    },
    async findByIdempotency(companyId, idempotencyKey) {
      const marker = idempotencyMarker(idempotencyKey);
      const { data, error } = await supabase
        .from("client_interactions")
        .select("id, company_id, executive_id, interaction_type, notes, outcome, follow_up_date, created_at")
        .eq("company_id", companyId)
        .ilike("notes", `%${marker}%`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) return null;
      return data;
    },
  };
}

export function buildCaptureRow(params: {
  input: CrmManualActionInput;
  deliveryState: CrmActionDeliveryState;
  source: CrmActionSource;
  idempotencyKey: string;
}): CrmActionCaptureRow {
  const companyId = assertValidCompanyId(params.input.companyId);
  const notes = formatCaptureProvenance({
    channel: params.input.channel,
    source: params.source,
    deliveryState: params.deliveryState,
    idempotencyKey: params.idempotencyKey,
    body: params.input.notes.trim(),
  });

  const outcome =
    params.deliveryState === "not_applicable"
      ? params.input.outcome?.trim() || null
      : params.deliveryState;

  return {
    company_id: companyId,
    executive_id: params.input.executiveId.trim(),
    interaction_type: mapInteractionTypeForChannel(params.input.channel),
    notes,
    outcome,
    follow_up_date: params.input.followUpDate?.trim() || null,
  };
}

export function resultFromExistingRow(
  row: ClientInteractionRow,
  idempotencyKey: string,
): CrmActionCaptureResult {
  const parsed = parseCaptureProvenance(row.notes);
  return {
    ok: true,
    recordId: row.id,
    idempotencyKey: parsed.idempotencyKey ?? idempotencyKey,
    deliveryState: parsed.deliveryState ?? "not_applicable",
    deduplicated: true,
  };
}

export async function insertGovernedCapture(
  params: {
    input: CrmManualActionInput;
    deliveryState: CrmActionDeliveryState;
    source: CrmActionSource;
    idempotencyKey: string;
  },
  deps: CrmActionCaptureDeps = defaultDeps(),
): Promise<CrmActionCaptureResult> {
  const companyId = assertValidCompanyId(params.input.companyId);
  const existing = await deps.findByIdempotency(companyId, params.idempotencyKey);
  if (existing) {
    return resultFromExistingRow(existing, params.idempotencyKey);
  }

  const row = buildCaptureRow(params);
  const { data, error } = await deps.insertInteraction(row);
  if (error || !data) {
    return captureFailure("insert_failed", error?.message ?? "Failed to persist governed action.");
  }

  return {
    ok: true,
    recordId: data.id,
    idempotencyKey: params.idempotencyKey,
    deliveryState: params.deliveryState,
    deduplicated: false,
  };
}

export async function captureCrmManualAction(
  input: CrmManualActionInput,
  deps: CrmActionCaptureDeps = defaultDeps(),
): Promise<CrmActionCaptureResult> {
  const validationError = validateManualActionInput(input);
  if (validationError) return validationError;

  const idempotencyKey = input.idempotencyKey?.trim() || crypto.randomUUID();
  return insertGovernedCapture(
    {
      input,
      deliveryState: "not_applicable",
      source: "manual",
      idempotencyKey,
    },
    deps,
  );
}
