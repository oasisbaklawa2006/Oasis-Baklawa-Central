import { supabase } from "@/integrations/supabase/client";
import { sendDispatchAlert } from "@/utils/whatsapp";
import { getFinanceExitFacts, type FinanceExitFacts } from "./financeExitAuthorityClient";

export class DispatchCustomerCommunicationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DispatchCustomerCommunicationError";
  }
}

export type DispatchCustomerCommunicationEligibility = {
  eligible: boolean;
  reason: string | null;
  facts: FinanceExitFacts | null;
};

export type DispatchCustomerCommunicationResult = {
  success: boolean;
  orderId: string;
  companyId: string;
  complaintWindowOpen: boolean | null;
  complaintDeadline: string | null;
  alreadyRecorded: boolean;
  error?: string;
};

function required(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new DispatchCustomerCommunicationError(`${field} is required`);
  return normalized;
}

export function assessDispatchCustomerCommunicationEligibility(
  facts: FinanceExitFacts | null,
): DispatchCustomerCommunicationEligibility {
  if (!facts) {
    return { eligible: false, reason: "Finance exit facts are not loaded", facts: null };
  }
  if (!facts.dispatchProofId) {
    return { eligible: false, reason: "Immutable gate-exit dispatch proof must be frozen first", facts };
  }
  if (!facts.finalInvoiceId) {
    return { eligible: false, reason: "Final invoice must exist before customer dispatch communication", facts };
  }
  if (facts.complaintClockBasis !== "FINAL_INVOICE_DATE") {
    return {
      eligible: false,
      reason: "Complaint window must be anchored to final invoice date",
      facts,
    };
  }
  if (facts.complaintWindowOpen !== true) {
    return {
      eligible: false,
      reason: "Complaint window is not open — cannot complete governed dispatch communication",
      facts,
    };
  }
  return { eligible: true, reason: null, facts };
}

async function loadCompanyContact(orderId: string): Promise<{ companyId: string; companyName: string; phone: string }> {
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("company_id, company:companies(id, business_name, phone)")
    .eq("id", orderId)
    .single();
  if (orderError || !order?.company_id) {
    throw new DispatchCustomerCommunicationError("Order company lineage is missing");
  }

  const company = Array.isArray(order.company) ? order.company[0] : order.company;
  const companyName =
    company && typeof company === "object" && "business_name" in company
      ? String((company as { business_name?: string }).business_name ?? "Customer")
      : "Customer";
  const phone =
    company && typeof company === "object" && "phone" in company
      ? String((company as { phone?: string | null }).phone ?? "").trim()
      : "";
  if (phone.length < 10) {
    throw new DispatchCustomerCommunicationError("Company contact phone is missing or invalid for dispatch communication");
  }

  return { companyId: order.company_id, companyName, phone };
}

function orderReferenceToken(orderId: string): string {
  return orderId.slice(0, 8).toUpperCase();
}

async function hasExistingDispatchCommunication(companyId: string, orderId: string): Promise<boolean> {
  const token = orderReferenceToken(orderId);
  const { data, error } = await supabase
    .from("client_interactions")
    .select("id")
    .eq("company_id", companyId)
    .ilike("notes", `%${token}%`)
    .ilike("notes", "%dispatched your order%")
    .limit(1);
  if (error) return false;
  return (data?.length ?? 0) > 0;
}

export async function recordGovernedCustomerDispatchCommunication(input: {
  orderId: string;
  trackingNumber?: string | null;
  invoiceUrl?: string | null;
}): Promise<DispatchCustomerCommunicationResult> {
  const orderId = required(input.orderId, "order id");
  const facts = await getFinanceExitFacts(orderId);
  const eligibility = assessDispatchCustomerCommunicationEligibility(facts);
  if (!eligibility.eligible || !eligibility.facts) {
    throw new DispatchCustomerCommunicationError(eligibility.reason ?? "Dispatch communication is not eligible");
  }

  const alreadyRecorded = await hasExistingDispatchCommunication(facts.companyId, orderId);
  if (alreadyRecorded) {
    return {
      success: true,
      orderId,
      companyId: facts.companyId,
      complaintWindowOpen: facts.complaintWindowOpen,
      complaintDeadline: facts.complaintDeadline,
      alreadyRecorded: true,
    };
  }

  const contact = await loadCompanyContact(orderId);
  const result = await sendDispatchAlert({
    phone: contact.phone,
    companyId: contact.companyId,
    companyName: contact.companyName,
    orderId,
    trackingNumber: input.trackingNumber?.trim() || undefined,
    invoiceUrl: input.invoiceUrl?.trim() || undefined,
  });

  if (!result.success) {
    throw new DispatchCustomerCommunicationError(result.error ?? "WhatsApp dispatch communication failed");
  }

  return {
    success: true,
    orderId,
    companyId: contact.companyId,
    complaintWindowOpen: facts.complaintWindowOpen,
    complaintDeadline: facts.complaintDeadline,
    alreadyRecorded: false,
  };
}
