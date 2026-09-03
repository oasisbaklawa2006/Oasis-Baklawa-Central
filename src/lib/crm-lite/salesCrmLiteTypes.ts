import type { Database } from "@/integrations/supabase/types";

export type CrmLiteCompany = Pick<
  Database["public"]["Tables"]["companies"]["Row"],
  | "id"
  | "business_name"
  | "gst_number"
  | "status"
  | "wallet_balance"
  | "credit_limit"
  | "current_balance"
  | "allow_credit"
  | "created_at"
  | "price_tier"
  | "discount_percentage"
>;

export type CrmLiteOrder = Pick<
  Database["public"]["Tables"]["orders"]["Row"],
  "id" | "company_id" | "order_number" | "sales_order_value" | "status" | "created_at"
>;

export type CrmLiteInteraction = Pick<
  Database["public"]["Tables"]["client_interactions"]["Row"],
  "id" | "company_id" | "interaction_type" | "notes" | "outcome" | "follow_up_date" | "created_at" | "executive_id"
>;

export type CrmLiteTask = Pick<
  Database["public"]["Tables"]["crm_tasks"]["Row"],
  "id" | "company_id" | "sales_exec_id" | "task_type" | "status" | "due_date" | "description" | "completed_at" | "created_at"
>;

export type CrmLiteTicket = Pick<
  Database["public"]["Tables"]["support_tickets"]["Row"],
  | "id"
  | "order_id"
  | "issue_type"
  | "status"
  | "severity"
  | "created_at"
  | "commission_blocked"
  | "customer_rating"
  | "admin_rating_speed"
  | "admin_rating_quality"
  | "admin_rating_communication"
  | "sla_resolution_due"
  | "sla_resolved_at"
> & {
  order?: Pick<Database["public"]["Tables"]["orders"]["Row"], "company_id" | "order_number"> | null;
};

export type GovernedCreditOrder = CrmLiteOrder & {
  bindingReady: boolean;
};
