import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  assessDispatchCustomerCommunicationEligibility,
  recordGovernedCustomerDispatchCommunication,
} from "../dispatchCustomerCommunicationClient";
import type { FinanceExitFacts } from "../financeExitAuthorityClient";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
    functions: { invoke: vi.fn() },
  },
}));

vi.mock("../financeExitAuthorityClient", () => ({
  getFinanceExitFacts: vi.fn(),
}));

vi.mock("@/utils/whatsapp", () => ({
  sendDispatchAlert: vi.fn(),
}));

import { supabase } from "@/integrations/supabase/client";
import { getFinanceExitFacts } from "../financeExitAuthorityClient";
import { sendDispatchAlert } from "@/utils/whatsapp";

const baseFacts: FinanceExitFacts = {
  orderId: "order-1",
  companyId: "company-1",
  orderStatus: "dispatched",
  financeDplReceiptId: "dpl-1",
  financeDplSourceAuthority: "FACT-C3",
  commercialVersionId: "cv-1",
  piId: "pi-1",
  finalInvoiceId: "inv-1",
  invoiceNumber: "INV-001",
  invoiceDate: "2026-09-01",
  invoiceGrossTotal: 1000,
  settlement: null,
  ewayEvidenceId: "eway-1",
  ewayStatus: "VALIDATED",
  ewayBillNumber: "EWB-1",
  dispatchClearanceEventId: "clear-1",
  dispatchClearanceDecision: "GRANTED",
  dispatchCleared: true,
  dispatchProofId: "proof-1",
  dispatchedAt: "2026-09-07T10:00:00Z",
  complaintClockBasis: "FINAL_INVOICE_DATE",
  complaintDeadline: "2026-09-17T18:30:00Z",
  complaintWindowOpen: true,
};

describe("dispatchCustomerCommunicationClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fail-closes when dispatch proof is missing", () => {
    const result = assessDispatchCustomerCommunicationEligibility({
      ...baseFacts,
      dispatchProofId: null,
    });
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain("dispatch proof");
  });

  it("fail-closes when complaint window is not open", () => {
    const result = assessDispatchCustomerCommunicationEligibility({
      ...baseFacts,
      complaintWindowOpen: false,
    });
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain("Complaint window");
  });

  it("records governed dispatch communication via WhatsApp edge function", async () => {
    vi.mocked(getFinanceExitFacts).mockResolvedValue(baseFacts);

    const fromMock = vi.fn((table: string) => {
      if (table === "client_interactions") {
        return {
          select: () => ({
            eq: () => ({
              ilike: () => ({
                ilike: () => ({
                  limit: async () => ({ data: [], error: null }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === "orders") {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: {
                  company_id: "company-1",
                  company: { id: "company-1", business_name: "Acme Foods", phone: "919876543210" },
                },
                error: null,
              }),
            }),
          }),
        };
      }
      return { select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) }) };
    });
    vi.mocked(supabase.from).mockImplementation(fromMock as unknown as typeof supabase.from);
    vi.mocked(sendDispatchAlert).mockResolvedValue({ success: true, data: { ok: true } });

    const result = await recordGovernedCustomerDispatchCommunication({ orderId: "order-1" });
    expect(result.success).toBe(true);
    expect(result.complaintWindowOpen).toBe(true);
    expect(sendDispatchAlert).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: "order-1", companyId: "company-1" }),
    );
  });
});
