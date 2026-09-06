import { supabase } from "@/integrations/supabase/client";
import { parseCrmLiteTickets } from "@/lib/crm-lite/parseCrmLiteTickets";
import { assertCustomer360CompanyAccess, normalizeCompanyId } from "./customer360Identity";
import { Customer360IdentityError } from "./customer360Identity";
import type {
  Customer360CompanyProfile,
  Customer360InteractionSummary,
  Customer360OrderSummary,
  Customer360ReadModel,
  Customer360Slice,
  Customer360TaskSummary,
  Customer360TicketSummary,
  Customer360ViewerContext,
} from "./customer360Types";

type CompanyRow = {
  id: string;
  business_name: string;
  status: string | null;
  phone: string | null;
  registered_address: string | null;
  gst_number: string | null;
  account_manager_id: string | null;
  allow_credit: boolean | null;
  credit_limit: number | null;
  wallet_balance: number | null;
  current_balance: number | null;
  total_outstanding: number;
  discount_percentage: number | null;
  payment_terms: string;
  price_tier: string | null;
  created_at: string | null;
};

function notGovernedSlice<T>(programmeOwner: string, reason: string): Customer360Slice<T> {
  return {
    availability: "unavailable_not_governed",
    programmeOwner,
    reason,
  };
}

function mapCompanyProfile(row: CompanyRow): Customer360CompanyProfile {
  return {
    companyId: row.id,
    businessName: row.business_name,
    status: row.status,
    phone: row.phone,
    registeredAddress: row.registered_address,
    gstNumber: row.gst_number,
    accountManagerId: row.account_manager_id,
    allowCredit: row.allow_credit,
    creditLimit: row.credit_limit,
    walletBalance: row.wallet_balance,
    currentBalance: row.current_balance,
    totalOutstanding: row.total_outstanding,
    discountPercentage: row.discount_percentage,
    paymentTerms: row.payment_terms,
    priceTier: row.price_tier,
    createdAt: row.created_at,
  };
}

export async function fetchCustomer360ReadModel(
  rawCompanyId: string,
  viewer: Customer360ViewerContext,
): Promise<Customer360ReadModel> {
  const companyId = normalizeCompanyId(rawCompanyId);
  assertCustomer360CompanyAccess(companyId, viewer);

  const { data: companyRow, error: companyError } = await supabase
    .from("companies")
    .select(
      "id, business_name, status, phone, registered_address, gst_number, account_manager_id, allow_credit, credit_limit, wallet_balance, current_balance, total_outstanding, discount_percentage, payment_terms, price_tier, created_at",
    )
    .eq("id", companyId)
    .maybeSingle();

  if (companyError) {
    throw new Customer360IdentityError("company_not_found", companyError.message);
  }
  if (!companyRow) {
    throw new Customer360IdentityError("company_not_found", "No company exists for the requested Customer 360 identity.");
  }

  const profileSlice: Customer360Slice<Customer360CompanyProfile> = {
    availability: "available",
    programmeOwner: "POINT59",
    data: mapCompanyProfile(companyRow as unknown as CompanyRow),
  };

  const [ordersRes, interactionsRes, tasksRes, ticketsRes] = await Promise.all([
    supabase
      .from("orders")
      .select("id, order_number, status, sales_order_value, created_at")
      .eq("company_id", companyId)
      .not("status", "in", '("draft","cart","cancelled")')
      .order("created_at", { ascending: false })
      .limit(25),
    supabase
      .from("client_interactions")
      .select("id, interaction_type, notes, outcome, follow_up_date, created_at")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(25),
    supabase
      .from("crm_tasks")
      .select("id, task_type, status, due_date, description, created_at")
      .eq("company_id", companyId)
      .order("due_date", { ascending: true })
      .limit(25),
    supabase
      .from("support_tickets")
      .select(
        "id, order_id, issue_type, status, created_at, order:orders(company_id, order_number)",
      )
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const ordersSlice: Customer360Slice<Customer360OrderSummary[]> = ordersRes.error
    ? {
        availability: "error",
        programmeOwner: "POINT59",
        errorMessage: ordersRes.error.message,
      }
    : {
        availability: "available",
        programmeOwner: "POINT59",
        data: (ordersRes.data ?? []).map((row) => ({
          orderId: row.id,
          orderNumber: row.order_number,
          status: row.status,
          salesOrderValue: row.sales_order_value,
          createdAt: row.created_at,
        })),
      };

  const interactionsSlice: Customer360Slice<Customer360InteractionSummary[]> = interactionsRes.error
    ? {
        availability: "error",
        programmeOwner: "POINT61",
        errorMessage: interactionsRes.error.message,
      }
    : {
        availability: "partial_crm_lite",
        programmeOwner: "POINT61",
        reason: "CRM-lite interactions only; unified communications ledger is not yet governed.",
        data: (interactionsRes.data ?? []).map((row) => ({
          id: row.id,
          interactionType: row.interaction_type,
          notes: row.notes,
          outcome: row.outcome,
          followUpDate: row.follow_up_date,
          createdAt: row.created_at,
        })),
      };

  const tasksSlice: Customer360Slice<Customer360TaskSummary[]> = tasksRes.error
    ? {
        availability: "error",
        programmeOwner: "POINT63",
        errorMessage: tasksRes.error.message,
      }
    : {
        availability: "partial_crm_lite",
        programmeOwner: "POINT63",
        reason: "CRM-lite tasks only; opportunities/samples health lane is not yet governed.",
        data: (tasksRes.data ?? []).map((row) => ({
          id: row.id,
          taskType: row.task_type,
          status: row.status,
          dueDate: row.due_date,
          description: row.description,
          createdAt: row.created_at,
        })),
      };

  const parsedTickets = parseCrmLiteTickets(ticketsRes.data ?? []).filter(
    (ticket) => ticket.order?.company_id === companyId,
  );
  const ticketsSlice: Customer360Slice<Customer360TicketSummary[]> = ticketsRes.error
    ? {
        availability: "error",
        programmeOwner: "POINT59",
        errorMessage: ticketsRes.error.message,
      }
    : {
        availability: "available",
        programmeOwner: "POINT59",
        data: parsedTickets.map((ticket) => ({
          id: ticket.id,
          orderId: ticket.order_id,
          orderNumber: ticket.order?.order_number ?? null,
          issueType: ticket.issue_type,
          status: ticket.status,
          createdAt: ticket.created_at,
        })),
      };

  return {
    identity: {
      companyId,
      resolvedAt: new Date().toISOString(),
    },
    profile: profileSlice,
    orders: ordersSlice,
    interactions: interactionsSlice,
    tasks: tasksSlice,
    tickets: ticketsSlice,
    branchesAndContacts: notGovernedSlice(
      "POINT60",
      "Company branch and contact hierarchy is not yet governed in Central.",
    ),
    communicationsLedger: notGovernedSlice(
      "POINT61",
      "Unified CRM communications ledger (calls, WA, email) is not yet governed.",
    ),
    dispatchHistory: notGovernedSlice(
      "DISPATCH_P0_456",
      "Company-scoped dispatch history aggregate is not yet governed; use order-level dispatch views.",
    ),
    financeExposure: notGovernedSlice(
      "POINT77",
      "Finance ageing and exposure consolidation (Points 77–81) is not yet governed in Customer 360.",
    ),
    customerHealth: notGovernedSlice(
      "POINT64",
      "Customer health, risk scoring, and next-best-action are not yet governed.",
    ),
  };
}
