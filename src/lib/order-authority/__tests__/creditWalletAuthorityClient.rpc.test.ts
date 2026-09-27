import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpcMock, fromMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
  fromMock: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: rpcMock,
    from: fromMock,
  },
}));

import {
  CreditWalletAuthorityError,
  decideCreditRequest,
  getCreditExposureFacts,
  getWalletBalance,
  recordWalletEntry,
  requestCredit,
  resolveCreditBinding,
} from "../creditWalletAuthorityClient";

function queryBuilder(result: { data: unknown; error: { message: string } | null }) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    then(onFulfilled: (value: typeof result) => unknown) {
      return Promise.resolve(result).then(onFulfilled);
    },
  };
  return builder;
}

const walletInput = {
  companyId: "company-1",
  direction: "credit" as const,
  amount: 1250,
  currency: "INR",
  orderId: "order-1",
  proformaInvoiceId: "pi-1",
  commercialVersionId: "version-1",
  sourceChannel: "CENTRAL_FINANCE",
  sourceReference: "return-1",
  reason: "Approved return",
  correlationId: "central:pf6b:wallet:abc",
  idempotencyKey: "central:pf6b:wallet:def",
  actorId: "actor-1",
};

const creditRequestInput = {
  companyId: "company-1",
  orderId: "order-1",
  proformaInvoiceId: "pi-1",
  commercialVersionId: "version-1",
  creditType: "short_term_so" as const,
  requestedAmount: 5000,
  sourceChannel: "CENTRAL_FINANCE",
  sourceReference: "request-1",
  reason: "Need credit",
  correlationId: "central:pf6b:request:abc",
  idempotencyKey: "central:pf6b:request:def",
  expiresAt: null,
  actorId: "actor-1",
};

describe("PF-6B creditWalletAuthorityClient RPC boundary", () => {
  beforeEach(() => {
    rpcMock.mockReset();
    fromMock.mockReset();
  });

  it("records wallet entries only through record_wallet_entry_v1 and returns canonical balance", async () => {
    rpcMock.mockResolvedValue({
      data: { entry_id: "entry-1", balance: 8750, already_applied: false },
      error: null,
    });

    const result = await recordWalletEntry(walletInput);

    expect(result).toEqual({ entryId: "entry-1", balance: 8750, alreadyApplied: false });
    expect(rpcMock).toHaveBeenCalledWith("record_wallet_entry_v1", expect.objectContaining({
      p_company_id: "company-1",
      p_direction: "credit",
      p_amount: 1250,
      p_actor_id: "actor-1",
      p_idempotency_key: "central:pf6b:wallet:def",
    }));
  });

  it("preserves idempotent wallet replay without mutating the returned balance", async () => {
    rpcMock.mockResolvedValue({
      data: { entry_id: "entry-1", balance: 8750, already_applied: true },
      error: null,
    });

    const result = await recordWalletEntry(walletInput);
    expect(result.alreadyApplied).toBe(true);
    expect(result.balance).toBe(8750);
  });

  it("reads wallet balance per company through get_wallet_balance_v1", async () => {
    rpcMock.mockResolvedValue({ data: 4200, error: null });

    const balance = await getWalletBalance("company-2");

    expect(balance).toBe(4200);
    expect(rpcMock).toHaveBeenCalledWith("get_wallet_balance_v1", { p_company_id: "company-2" });
    expect(rpcMock).not.toHaveBeenCalledWith("get_wallet_balance_v1", { p_company_id: "company-1" });
  });

  it("routes credit requests and decisions through canonical Core RPCs", async () => {
    rpcMock
      .mockResolvedValueOnce({
        data: { request_id: "req-1", status: "pending", already_requested: false },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { request_id: "req-1", status: "approved", already_decided: false },
        error: null,
      });

    const request = await requestCredit(creditRequestInput);
    const decision = await decideCreditRequest({
      requestId: "req-1",
      approve: true,
      reason: "Approved by Finance",
      sourceChannel: "CENTRAL_FINANCE",
      correlationId: "central:pf6b:decision:abc",
      idempotencyKey: "central:pf6b:decision:def",
      actorId: "finance-actor-1",
    });

    expect(request).toEqual({ requestId: "req-1", status: "pending", alreadyRequested: false });
    expect(decision).toEqual({ requestId: "req-1", status: "approved", alreadyDecided: false });
    expect(rpcMock).toHaveBeenNthCalledWith(1, "request_credit_authority_v1", expect.objectContaining({
      p_company_id: "company-1",
      p_credit_type: "short_term_so",
      p_requested_amount: 5000,
    }));
    expect(rpcMock).toHaveBeenNthCalledWith(2, "decide_credit_request_v1", expect.objectContaining({
      p_request_id: "req-1",
      p_approve: true,
      p_actor_id: "finance-actor-1",
    }));
  });

  it("keeps long-term credit decisions on the same governed decision RPC", async () => {
    rpcMock.mockResolvedValue({
      data: { request_id: "req-lt-1", status: "rejected", already_decided: true },
      error: null,
    });

    const decision = await decideCreditRequest({
      requestId: "req-lt-1",
      approve: false,
      reason: "Management approval required",
      sourceChannel: "CENTRAL_FINANCE",
      correlationId: "central:pf6b:decision:lt",
      idempotencyKey: "central:pf6b:decision:lt",
      actorId: "finance-head-1",
    });

    expect(decision.alreadyDecided).toBe(true);
    expect(rpcMock).toHaveBeenCalledWith("decide_credit_request_v1", expect.objectContaining({
      p_request_id: "req-lt-1",
      p_approve: false,
    }));
  });

  it("returns factual credit exposure only and rejects clearance projections", async () => {
    rpcMock.mockResolvedValue({
      data: {
        company_id: "company-1",
        order_id: "order-1",
        pi_id: "pi-1",
        commercial_version_id: "version-1",
        exposure_facts_only: true,
        clearance_decision: null,
        wallet_balance: 500,
      },
      error: null,
    });

    const facts = await getCreditExposureFacts("company-1", "pi-1", "version-1");

    expect(facts.exposure_facts_only).toBe(true);
    expect(facts.clearance_decision).toBeNull();
    expect(rpcMock).toHaveBeenCalledWith("get_credit_exposure_facts_v1", {
      p_company_id: "company-1",
      p_pi_id: "pi-1",
      p_commercial_version_id: "version-1",
    });

    rpcMock.mockResolvedValue({
      data: {
        company_id: "company-1",
        order_id: "order-1",
        pi_id: "pi-1",
        commercial_version_id: "version-1",
        exposure_facts_only: true,
        clearance_decision: "CLEARED",
      },
      error: null,
    });
    await expect(getCreditExposureFacts("company-1", "pi-1", "version-1")).rejects.toThrow(CreditWalletAuthorityError);
  });

  it("isolates company scope in wallet balance reads", async () => {
    rpcMock.mockImplementation(async (_fn: string, args: Record<string, unknown>) => {
      if (args.p_company_id === "company-a") return { data: 100, error: null };
      if (args.p_company_id === "company-b") return { data: 250, error: null };
      return { data: null, error: { message: "unknown company" } };
    });

    expect(await getWalletBalance("company-a")).toBe(100);
    expect(await getWalletBalance("company-b")).toBe(250);
    await expect(getWalletBalance("company-c")).rejects.toThrow(CreditWalletAuthorityError);
  });

  it("fails closed when Core RPCs are unavailable", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "function not found", code: "42883" } });
    await expect(getWalletBalance("company-1")).rejects.toThrow("function not found");
    await expect(recordWalletEntry(walletInput)).rejects.toThrow(CreditWalletAuthorityError);
    await expect(requestCredit(creditRequestInput)).rejects.toThrow(CreditWalletAuthorityError);
  });

  it("requires a single governed PI binding before PF-6B action", async () => {
    fromMock.mockReturnValue(queryBuilder({
      data: [
        {
          id: "pi-1",
          order_id: "order-1",
          commercial_version_id: "version-1",
          status: "ISSUED",
        },
      ],
      error: null,
    }));

    const binding = await resolveCreditBinding("order-1");
    expect(binding).toEqual({
      piId: "pi-1",
      orderId: "order-1",
      commercialVersionId: "version-1",
      status: "ISSUED",
    });

    fromMock.mockReturnValue(queryBuilder({ data: [], error: null }));
    await expect(resolveCreditBinding("order-2")).rejects.toThrow("single governed PI");

    fromMock.mockReturnValue(queryBuilder({
      data: [
        { id: "pi-1", order_id: "order-3", commercial_version_id: "version-1", status: "ISSUED" },
        { id: "pi-2", order_id: "order-3", commercial_version_id: "version-2", status: "READY_FOR_ISSUE" },
      ],
      error: null,
    }));
    await expect(resolveCreditBinding("order-3")).rejects.toThrow("single governed PI");
  });
});
