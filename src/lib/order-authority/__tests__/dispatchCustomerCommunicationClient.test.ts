import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  assessDispatchCustomerCommunicationEligibility,
  DISPATCH_WHATSAPP_COMMISSIONED,
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

  it("keeps physical eligibility separate from outbound WhatsApp commissioning", () => {
    expect(assessDispatchCustomerCommunicationEligibility(baseFacts).eligible).toBe(true);
    expect(DISPATCH_WHATSAPP_COMMISSIONED).toBe(false);
  });

  it("refuses a verified dispatch until Core recipient/receipt authority is commissioned", async () => {
    vi.mocked(getFinanceExitFacts).mockResolvedValue(baseFacts);

    await expect(
      recordGovernedCustomerDispatchCommunication({ orderId: "order-1" }),
    ).rejects.toThrow("Customer WhatsApp not sent");
    expect(sendDispatchAlert).not.toHaveBeenCalled();
    expect(supabase.from).not.toHaveBeenCalled();
    expect(supabase.functions.invoke).not.toHaveBeenCalled();
  });

  it("refuses missing dispatch proof without attempting messaging", async () => {
    vi.mocked(getFinanceExitFacts).mockResolvedValue({
      ...baseFacts,
      dispatchProofId: null,
    });
    await expect(
      recordGovernedCustomerDispatchCommunication({ orderId: "order-1" }),
    ).rejects.toThrow("dispatch proof");
    expect(sendDispatchAlert).not.toHaveBeenCalled();
  });
});
