/**
 * Point 59 — Customer 360 operational read model types.
 * Canonical customer identity is `companies.id` (company_id).
 */

import type { CrmCommunicationHistoryReadModel } from "@/lib/crm-communication-history/crmCommunicationHistoryTypes";
import type { CrmWorkItemsReadModel } from "@/lib/crm-work-items/crmWorkItemsTypes";

export type Customer360SliceAvailability =
  | "available"
  | "partial_crm_lite"
  | "unavailable_not_governed"
  | "error";

export type Customer360IdentityFailure =
  | "invalid_company_id"
  | "company_not_found"
  | "cross_company_access_denied"
  | "ambiguous_identity";

export type Customer360CompanyProfile = {
  companyId: string;
  businessName: string;
  status: string | null;
  phone: string | null;
  registeredAddress: string | null;
  gstNumber: string | null;
  accountManagerId: string | null;
  allowCredit: boolean | null;
  creditLimit: number | null;
  walletBalance: number | null;
  currentBalance: number | null;
  totalOutstanding: number | null;
  discountPercentage: number | null;
  paymentTerms: string | null;
  priceTier: string | null;
  createdAt: string | null;
};

export type Customer360OrderSummary = {
  orderId: string;
  orderNumber: string | null;
  status: string | null;
  salesOrderValue: number | null;
  createdAt: string | null;
};

export type Customer360InteractionSummary = {
  id: string;
  interactionType: string | null;
  notes: string | null;
  outcome: string | null;
  followUpDate: string | null;
  createdAt: string | null;
};

export type Customer360TaskSummary = {
  id: string;
  taskType: string | null;
  status: string | null;
  dueDate: string | null;
  description: string | null;
  createdAt: string | null;
};

export type Customer360TicketSummary = {
  id: string;
  orderId: string;
  orderNumber: string | null;
  issueType: string;
  status: string;
  createdAt: string | null;
};

export type Customer360Slice<T> = {
  availability: Customer360SliceAvailability;
  programmeOwner: string;
  reason?: string;
  data?: T;
  errorMessage?: string;
};

export type Customer360ReadModel = {
  identity: {
    companyId: string;
    resolvedAt: string;
  };
  profile: Customer360Slice<Customer360CompanyProfile>;
  orders: Customer360Slice<Customer360OrderSummary[]>;
  interactions: Customer360Slice<Customer360InteractionSummary[]>;
  tasks: Customer360Slice<Customer360TaskSummary[]>;
  tickets: Customer360Slice<Customer360TicketSummary[]>;
  branchesAndContacts: Customer360Slice<never>;
  communicationsLedger: Customer360Slice<CrmCommunicationHistoryReadModel>;
  workItemsLedger: Customer360Slice<CrmWorkItemsReadModel>;
  dispatchHistory: Customer360Slice<never>;
  financeExposure: Customer360Slice<never>;
  customerHealth: Customer360Slice<never>;
};

export type Customer360ViewerContext = {
  viewerCompanyId: string | null;
  isStorefrontViewer: boolean;
};
