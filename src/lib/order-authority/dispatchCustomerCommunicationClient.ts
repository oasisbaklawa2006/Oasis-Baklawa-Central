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

/**
 * Customer dispatch WhatsApp is not commissioned until Core owns an immutable
 * dispatch-proof command receipt and verifies recipient authority, consent,
 * provider template and callback status. This is intentionally not a browser
 * feature flag: the UI cannot independently authorize external messaging.
 */
export const DISPATCH_WHATSAPP_COMMISSIONED = false as boolean;

export async function recordGovernedCustomerDispatchCommunication(input: {
  orderId: string;
  trackingNumber?: string | null;
  invoiceUrl?: string | null;
}): Promise<DispatchCustomerCommunicationResult> {
  const orderId = required(input.orderId, "order id");
  const facts = await getFinanceExitFacts(orderId);
  const eligibility = assessDispatchCustomerCommunicationEligibility(facts);
  if (!eligibility.eligible) {
    throw new DispatchCustomerCommunicationError(
      eligibility.reason ?? "Dispatch communication is not eligible",
    );
  }

  // This function must not resume an automatic provider send using
  // companies.phone or client_interactions.notes as a dedupe surrogate.
  // Before commissioning, implement a protected Core-owned durable command
  // keyed to immutable dispatchProofId and authenticated recipient approval.
  throw new DispatchCustomerCommunicationError(
    "Customer WhatsApp not sent: governed recipient and durable dispatch receipt are pending",
  );
}
