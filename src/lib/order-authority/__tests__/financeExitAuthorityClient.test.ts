import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));

import {
  decideFinanceDispatchClearance,
  getFinanceExitFacts,
  issueFinalInvoice,
  receiveSubmittedB2bDpls,
  recordDispatchProof,
  recordEwayEvidence,
} from "@/lib/order-authority/financeExitAuthorityClient";

const digest = vi.fn(async () => new Uint8Array(32).buffer);

beforeAll(() => {
  vi.stubGlobal("crypto", { subtle: { digest } });
});
afterAll(() => vi.unstubAllGlobals());
beforeEach(() => {
  rpc.mockReset();
  digest.mockClear();
});

describe("Finance Exit authority client", () => {
  it("reads canonical Finance Exit facts and enforces invoice-date complaint clock", async () => {
    rpc.mockResolvedValueOnce({ data: {
      order_id: "o1", company_id: "c1", order_status: "packed_ready", payment_verified_is_not_clearance: true,
      finance_dpl_receipt_id: "r1", finance_dpl_source_authority: "b2b_dispatch_packing_list_versions", commercial_version_id: "cv1", pi_id: "pi1",
      final_invoice_id: "fi1", invoice_number: "INV-1", invoice_date: "2026-09-01", invoice_gross_total: 100, settlement: null,
      eway_evidence_id: null, eway_status: null, eway_bill_number: null, dispatch_clearance_event_id: null,
      dispatch_clearance_decision: null, dispatch_cleared: false, dispatch_proof_id: null, dispatched_at: null,
      complaint_clock_basis: "FINAL_INVOICE_DATE", complaint_deadline: "2026-09-10T18:30:00Z", complaint_window_open: true,
    }, error: null });
    const facts = await getFinanceExitFacts("o1");
    expect(facts.piId).toBe("pi1");
    expect(facts.invoiceDate).toBe("2026-09-01");
    expect(facts.complaintClockBasis).toBe("FINAL_INVOICE_DATE");
    expect(facts.complaintWindowOpen).toBe(true);
    expect(rpc).toHaveBeenCalledWith("get_finance_exit_facts_v1", { p_order_id: "o1" });
  });

  it("fails closed if Core reports a non-invoice complaint clock", async () => {
    rpc.mockResolvedValueOnce({ data: {
      order_id: "o1", company_id: "c1", order_status: "packed_ready", payment_verified_is_not_clearance: true,
      final_invoice_id: "fi1", complaint_clock_basis: "DELIVERY_DATE",
    }, error: null });
    await expect(getFinanceExitFacts("o1")).rejects.toThrow("not anchored to final invoice date");
  });

  it("receives submitted FACT-C2 DPLs without accepting browser-composed lines or cartons", async () => {
    rpc.mockResolvedValueOnce({ data: [{ receipt_id: "r1", already_received: false }], error: null });
    await receiveSubmittedB2bDpls("o1", "dispatch-dpl-submission", "actor1");
    const [fn, args] = rpc.mock.calls[0];
    expect(fn).toBe("receive_submitted_b2b_dispatch_dpls_v1");
    expect(args).toMatchObject({ p_order_id: "o1", p_evidence_reference: "dispatch-dpl-submission", p_actor_id: "actor1" });
    expect(args).not.toHaveProperty("p_dpl_snapshot");
    expect(args).not.toHaveProperty("p_carton_ids");
  });

  it("issues final invoice only through canonical Core authority with exact argument mapping", async () => {
    rpc.mockResolvedValueOnce({ data: [{ final_invoice_id: "fi1", invoice_number: "INV-1", gross_total: 100, already_issued: false }], error: null });
    await issueFinalInvoice({ orderId:"o1",piId:"pi1",commercialVersionId:"cv1",financeDplReceiptId:"r1",invoiceNumber:"INV-1",invoiceDate:"2026-09-01",documentReference:"storage:invoice.pdf",reason:"Final DPL verified",actorId:"actor1" });
    const [fn, args] = rpc.mock.calls[0];
    expect(fn).toBe("issue_final_invoice_v1");
    expect(args).toMatchObject({
      p_order_id: "o1",
      p_pi_id: "pi1",
      p_commercial_version_id: "cv1",
      p_finance_dpl_receipt_id: "r1",
      p_invoice_number: "INV-1",
      p_invoice_date: "2026-09-01",
      p_document_reference: "storage:invoice.pdf",
      p_reason: "Final DPL verified",
      p_actor_id: "actor1",
      p_correlation_id: expect.any(String),
      p_idempotency_key: expect.any(String),
    });
  });

  it("records governed E-way evidence and explicit Dispatch Clearance", async () => {
    rpc.mockResolvedValueOnce({ data: [{ eway_evidence_id:"e1",status:"NOT_REQUIRED",already_recorded:false }], error:null });
    await recordEwayEvidence({ finalInvoiceId:"fi1",status:"NOT_REQUIRED",policyReason:"Not required under applicable movement rule",actorId:"actor1" });
    expect(rpc.mock.calls[0][0]).toBe("record_eway_bill_evidence_v1");
    rpc.mockResolvedValueOnce({ data: [{ clearance_event_id:"fc1",decision:"GRANTED",already_decided:false }], error:null });
    await decideFinanceDispatchClearance({ finalInvoiceId:"fi1",decision:"GRANTED",reason:"Settlement and transport documents verified",evidenceReference:"finance-review",actorId:"actor1" });
    expect(rpc.mock.calls[1][0]).toBe("decide_finance_dispatch_clearance_v1");
  });

  it("freezes final dispatch proof with applicable transport credentials", async () => {
    rpc.mockResolvedValueOnce({ data: [{ dispatch_proof_id:"dp1",proof_fingerprint:"a".repeat(64),already_recorded:false }], error:null });
    await recordDispatchProof({
      orderId:"o1", transporter:"Carrier", transportMode:"ROAD", lrAwbBilty:"LR-1",
      vehicleNumber:"DL01AB1234", driverName:"Driver", driverPhone:"9876543210", trackingReference:"TRK-1",
      evidenceReferences:["proof:1"], dispatchedAt:"2026-09-01T10:00:00Z", actorId:"actor1",
    });
    const [fn, args] = rpc.mock.calls[0];
    expect(fn).toBe("record_dispatch_proof_packet_v1");
    expect(args.p_transport_snapshot).toEqual({
      transporter:"Carrier", transport_mode:"ROAD", lr_awb_bilty:"LR-1", vehicle_number:"DL01AB1234",
      driver_name:"Driver", driver_phone:"9876543210", tracking_reference:"TRK-1",
    });
  });

  it("requires road driver and vehicle credentials before calling Core", async () => {
    await expect(recordDispatchProof({
      orderId:"o1", transporter:"Carrier", transportMode:"ROAD", lrAwbBilty:"LR-1",
      evidenceReferences:["proof:1"], dispatchedAt:"2026-09-01T10:00:00Z", actorId:"actor1",
    })).rejects.toThrow("vehicle number is required");
    expect(rpc).not.toHaveBeenCalled();
  });
});
