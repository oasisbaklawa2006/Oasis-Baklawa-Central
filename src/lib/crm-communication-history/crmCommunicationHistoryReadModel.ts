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
  ClientInteractionLedgerRow,
  CrmCommunicationHistoryReadModel,
} from "./crmCommunicationHistoryTypes";
import {
  CLIENT_INTERACTION_LEDGER_SELECT,
  mapClientInteractionLedgerRows,
  resolveStandaloneCommunicationHistoryLimit,
} from "./crmCommunicationHistoryTypes";

export async function fetchCrmCommunicationHistory(
  rawCompanyId: string,
  viewer: Customer360ViewerContext,
  options?: { limit?: number },
): Promise<CrmCommunicationHistoryReadModel> {
  const companyId = normalizeCompanyId(rawCompanyId);
  assertCustomer360CompanyAccess(companyId, viewer);

  const limit = resolveStandaloneCommunicationHistoryLimit(options?.limit);

  const { data, error } = await supabase
    .from("client_interactions")
    .select(CLIENT_INTERACTION_LEDGER_SELECT)
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`CRM communication history read failed: ${error.message}`);
  }

  const rows = mapClientInteractionLedgerRows(data);

  return buildCrmCommunicationHistoryReadModel(companyId, rows, { recordLimit: limit });
}

/** Pure builder for tests and Customer 360 adaptor wiring. */
export function buildCrmCommunicationHistoryReadModel(
  companyId: string,
  rows: ClientInteractionLedgerRow[],
  options?: { recordLimit?: number },
): CrmCommunicationHistoryReadModel {
  const normalizedCompanyId = companyId.toLowerCase();
  return {
    companyId: normalizedCompanyId,
    resolvedAt: new Date().toISOString(),
    recordLimit: options?.recordLimit ?? rows.length,
    entries: buildCommunicationHistoryFromClientInteractions(rows, normalizedCompanyId),
    channels: buildCrmCommunicationChannelGovernance(),
  };
}
