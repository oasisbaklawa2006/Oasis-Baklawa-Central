import { supabase } from "@/integrations/supabase/client";
import { buildCrmCommunicationHistoryReadModel } from "@/lib/crm-communication-history/crmCommunicationHistoryReadModel";
import {
  CLIENT_INTERACTION_LEDGER_SELECT,
  CUSTOMER360_COMMUNICATION_HISTORY_LIMIT,
  mapClientInteractionLedgerRows,
} from "@/lib/crm-communication-history/crmCommunicationHistoryTypes";
import { getWalletBalance } from "@/lib/order-authority/creditWalletAuthorityClient";
import { parseCrmLiteTickets } from "@/lib/crm-lite/parseCrmLiteTickets";
import {
  buildCustomerHealthReadModel,
  buildFinanceExposureFromProfile,
  mapDeliveryAddressRow,
} from "./customer360DerivedSlices";
import { assertCustomer360CompanyAccess, normalizeCompanyId } from "./customer360Identity";
import { Customer360IdentityError } from "./customer360Identity";
import type {
  Customer360CompanyProfile,
  Customer360DeliverySite,
  Customer360FinanceExposure,
  Customer360HealthReadModel,
  Customer360InteractionSummary,
  Customer360OrderSummary,
  Customer360ReadModel,
  Customer360Slice,
  Customer360TaskSummary,
  Customer360TicketSummary,
  Customer360ViewerContext,
  Customer360WhatsappOrderLink,
} from "./customer360Types";
import type { CrmCommunicationHistoryReadModel } from "@/lib/crm-communication-history/crmCommunicationHistoryTypes";

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

  assertCustomer360CompanyAccess(
    companyId,
    viewer,
    (companyRow as unknown as CompanyRow).account_manager_id,
  );

  const mappedCompany = companyRow as unknown as CompanyRow;
  let governedWalletBalance: number | null = mappedCompany.wallet_balance;
  try {
    governedWalletBalance = await getWalletBalance(companyId);
  } catch {
    governedWalletBalance = null;
  }

  const profileSlice: Customer360Slice<Customer360CompanyProfile> = {
    availability: governedWalletBalance == null ? "partial_crm_lite" : "available",
    programmeOwner: "POINT59",
    reason:
      governedWalletBalance == null
        ? "Wallet balance uses PF-6B RPC when available; column fallback is not shown as authoritative."
        : undefined,
    data: mapCompanyProfile({
      ...mappedCompany,
      wallet_balance: governedWalletBalance,
    }),
  };

  let interactionsQuery = supabase
    .from("client_interactions")
    .select(CLIENT_INTERACTION_LEDGER_SELECT)
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(CUSTOMER360_COMMUNICATION_HISTORY_LIMIT);
  if (viewer.isSalesExecutiveViewer && viewer.viewerUserId) {
    interactionsQuery = interactionsQuery.eq("executive_id", viewer.viewerUserId);
  }

  let tasksQuery = supabase
    .from("crm_tasks")
    .select("id, task_type, status, due_date, description, created_at")
    .eq("company_id", companyId)
    .order("due_date", { ascending: true })
    .limit(25);
  if (viewer.isSalesExecutiveViewer && viewer.viewerUserId) {
    tasksQuery = tasksQuery.eq("sales_exec_id", viewer.viewerUserId);
  }

  const [ordersRes, interactionsRes, tasksRes, deliverySitesRes, waDraftsRes] = await Promise.all([
    supabase
      .from("orders")
      .select("id, order_number, status, sales_order_value, created_at")
      .eq("company_id", companyId)
      .not("status", "in", '("draft","cart","cancelled")')
      .order("created_at", { ascending: false })
      .limit(25),
    interactionsQuery,
    tasksQuery,
    supabase
      .from("delivery_addresses")
      .select("id, label, street_address, city, state, pincode, contact_person, contact_phone, is_default")
      .eq("company_id", companyId)
      .order("is_default", { ascending: false })
      .order("label", { ascending: true })
      .limit(25),
    supabase
      .from("sales_order_drafts")
      .select("id, packet_id, status, promoted_order_id, readiness_overall_score, updated_at")
      .eq("company_id", companyId)
      .order("updated_at", { ascending: false })
      .limit(10),
  ]);

  const orderIds = (ordersRes.data ?? []).map((row) => row.id);
  const ticketsRes =
    orderIds.length === 0
      ? { data: [] as unknown[], error: null }
      : await supabase
          .from("support_tickets")
          .select(
            "id, order_id, issue_type, status, created_at, order:orders(company_id, order_number)",
          )
          .in("order_id", orderIds)
          .order("created_at", { ascending: false })
          .limit(25);

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
        reason:
          viewer.isSalesExecutiveViewer
            ? "CRM-lite interactions scoped to the signed-in sales executive. Governed multi-channel history is on the communicationsLedger slice (Point 61)."
            : "CRM-lite interaction summary (bounded preview). Governed multi-channel history is on the communicationsLedger slice (Point 61).",
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
        reason: viewer.isSalesExecutiveViewer
          ? "CRM-lite tasks scoped to the signed-in sales executive."
          : "CRM-lite tasks only; opportunities/samples health lane is not yet governed.",
        data: (tasksRes.data ?? []).map((row) => ({
          id: row.id,
          taskType: row.task_type,
          status: row.status,
          dueDate: row.due_date,
          description: row.description,
          createdAt: row.created_at,
        })),
      };

  const parsedTickets = parseCrmLiteTickets(ticketsRes.data ?? []);
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

  const communicationsLedgerSlice: Customer360Slice<CrmCommunicationHistoryReadModel> = interactionsRes.error
    ? {
        availability: "error",
        programmeOwner: "POINT61",
        errorMessage: interactionsRes.error.message,
      }
    : {
        availability: "available",
        programmeOwner: "POINT61",
        data: buildCrmCommunicationHistoryReadModel(
          companyId,
          mapClientInteractionLedgerRows(interactionsRes.data),
          { recordLimit: CUSTOMER360_COMMUNICATION_HISTORY_LIMIT },
        ),
      };

  const mappedInteractions =
    interactionsSlice.availability === "partial_crm_lite" ? interactionsSlice.data ?? [] : [];
  const mappedTasks = tasksSlice.availability === "partial_crm_lite" ? tasksSlice.data ?? [] : [];
  const mappedProfile = profileSlice.data;

  const branchesAndContactsSlice: Customer360Slice<Customer360DeliverySite[]> =
    deliverySitesRes.error
      ? {
          availability: "error",
          programmeOwner: "POINT60",
          errorMessage: deliverySitesRes.error.message,
        }
      : {
          availability: "available",
          programmeOwner: "POINT60",
          data: (deliverySitesRes.data ?? []).map((row) =>
            mapDeliveryAddressRow(row as {
              id: string;
              label: string;
              street_address: string;
              city: string;
              state: string;
              pincode: string;
              contact_person: string | null;
              contact_phone: string | null;
              is_default: boolean | null;
            }),
          ),
        };

  const financeExposureSlice: Customer360Slice<Customer360FinanceExposure> =
    mappedProfile
      ? {
          availability: "available",
          programmeOwner: "POINT77",
          reason: "Factual exposure from company profile fields; ageing consolidation remains Core-owned.",
          data: buildFinanceExposureFromProfile(mappedProfile),
        }
      : {
          availability: "error",
          programmeOwner: "POINT77",
          errorMessage: "Company profile unavailable for finance exposure projection.",
        };

  const customerHealthSlice: Customer360Slice<Customer360HealthReadModel> =
    mappedProfile
      ? {
          availability: "available",
          programmeOwner: "POINT64",
          reason: "Deterministic signals derived from CRM-lite tasks, interactions, and profile facts only.",
          data: buildCustomerHealthReadModel(mappedProfile, mappedTasks, mappedInteractions),
        }
      : {
          availability: "error",
          programmeOwner: "POINT64",
          errorMessage: "Company profile unavailable for health signal projection.",
        };

  const whatsappOrderLinkageSlice: Customer360Slice<Customer360WhatsappOrderLink[]> = waDraftsRes.error
    ? {
        availability: "error",
        programmeOwner: "WA",
        errorMessage: waDraftsRes.error.message,
      }
    : {
        availability: "available",
        programmeOwner: "WA",
        reason: "Read-only governed sales_order_drafts linkage for WhatsApp → order promotion lineage.",
        data: (waDraftsRes.data ?? []).map((row) => ({
          draftId: row.id,
          packetId: row.packet_id,
          status: row.status,
          promotedOrderId: row.promoted_order_id,
          readinessOverallScore: row.readiness_overall_score,
          updatedAt: row.updated_at,
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
    branchesAndContacts: branchesAndContactsSlice,
    communicationsLedger: communicationsLedgerSlice,
    dispatchHistory: notGovernedSlice(
      "DISPATCH_P0_456",
      "Company-scoped dispatch history aggregate is not yet governed; use order-level dispatch views.",
    ),
    financeExposure: financeExposureSlice,
    customerHealth: customerHealthSlice,
    whatsappOrderLinkage: whatsappOrderLinkageSlice,
  };
}
