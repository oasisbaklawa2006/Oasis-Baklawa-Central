import { supabase } from "@/integrations/supabase/client";
import {
  assertCustomer360CompanyAccess,
  normalizeCompanyId,
} from "@/lib/customer-360/customer360Identity";
import type { Customer360ViewerContext } from "@/lib/customer-360/customer360Types";
import { buildWorkItemsReadModelFromRows } from "./crmWorkItemsNormalizer";
import type {
  ClientInteractionFollowUpRow,
  CrmTaskRow,
  CrmWorkItemsReadModel,
} from "./crmWorkItemsTypes";

const DEFAULT_LIMIT = 100;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function fetchCrmWorkItems(
  rawCompanyId: string,
  viewer: Customer360ViewerContext,
  options?: { limit?: number; referenceDate?: string },
): Promise<CrmWorkItemsReadModel> {
  const companyId = normalizeCompanyId(rawCompanyId);
  assertCustomer360CompanyAccess(companyId, viewer);

  const limit = options?.limit ?? DEFAULT_LIMIT;
  const referenceDate = options?.referenceDate ?? todayIso();

  const [tasksRes, interactionsRes] = await Promise.all([
    supabase
      .from("crm_tasks")
      .select(
        "id, company_id, sales_exec_id, task_type, status, due_date, description, completed_at, created_at",
      )
      .eq("company_id", companyId)
      .order("due_date", { ascending: true })
      .limit(limit),
    supabase
      .from("client_interactions")
      .select(
        "id, company_id, executive_id, interaction_type, notes, follow_up_date, created_at",
      )
      .eq("company_id", companyId)
      .not("follow_up_date", "is", null)
      .order("follow_up_date", { ascending: true })
      .limit(limit),
  ]);

  if (tasksRes.error) {
    throw new Error(`CRM work items read failed: ${tasksRes.error.message}`);
  }
  if (interactionsRes.error) {
    throw new Error(`CRM follow-up commitments read failed: ${interactionsRes.error.message}`);
  }

  return buildWorkItemsReadModelFromRows(
    companyId,
    (tasksRes.data ?? []) as CrmTaskRow[],
    (interactionsRes.data ?? []) as ClientInteractionFollowUpRow[],
    referenceDate,
  );
}

/** Pure builder for tests and Customer 360 adaptor wiring. */
export function buildCrmWorkItemsReadModel(
  companyId: string,
  taskRows: CrmTaskRow[],
  interactionRows: ClientInteractionFollowUpRow[],
  referenceDate?: string,
): CrmWorkItemsReadModel {
  return buildWorkItemsReadModelFromRows(
    companyId,
    taskRows,
    interactionRows,
    referenceDate ?? todayIso(),
  );
}
