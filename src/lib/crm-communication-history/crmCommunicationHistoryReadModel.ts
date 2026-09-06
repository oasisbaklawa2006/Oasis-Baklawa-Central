import { supabase } from "@/integrations/supabase/client";
import {
  assertCustomer360CompanyAccess,
  normalizeCompanyId,
} from "@/lib/customer-360/customer360Identity";
import type { Customer360ViewerContext } from "@/lib/customer-360/customer360Types";
import {
  buildCommunicationHistoryFromClientInteractions,
  buildCrmCommunicationChannelGovernance,
} from "./crmCommunicationHistoryNormalizer";
import type {
  ClientInteractionRow,
  CrmCommunicationHistoryReadModel,
} from "./crmCommunicationHistoryTypes";

const DEFAULT_LIMIT = 100;

export async function fetchCrmCommunicationHistory(
  rawCompanyId: string,
  viewer: Customer360ViewerContext,
  options?: { limit?: number },
): Promise<CrmCommunicationHistoryReadModel> {
  const companyId = normalizeCompanyId(rawCompanyId);
  assertCustomer360CompanyAccess(companyId, viewer);

  const limit = options?.limit ?? DEFAULT_LIMIT;

  const { data, error } = await supabase
    .from("client_interactions")
    .select(
      "id, company_id, executive_id, interaction_type, notes, outcome, follow_up_date, created_at",
    )
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`CRM communication history read failed: ${error.message}`);
  }

  const rows = (data ?? []) as ClientInteractionRow[];
  const entries = buildCommunicationHistoryFromClientInteractions(rows, companyId);

  return {
    companyId,
    resolvedAt: new Date().toISOString(),
    entries,
    channels: buildCrmCommunicationChannelGovernance(),
  };
}

/** Pure builder for tests and Customer 360 adaptor wiring. */
export function buildCrmCommunicationHistoryReadModel(
  companyId: string,
  rows: ClientInteractionRow[],
): CrmCommunicationHistoryReadModel {
  const normalizedCompanyId = companyId.toLowerCase();
  return {
    companyId: normalizedCompanyId,
    resolvedAt: new Date().toISOString(),
    entries: buildCommunicationHistoryFromClientInteractions(rows, normalizedCompanyId),
    channels: buildCrmCommunicationChannelGovernance(),
  };
}
