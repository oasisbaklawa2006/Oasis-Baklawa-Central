import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildOrderChangeCorrelationId,
  buildOrderChangeDecisionIdentity,
  buildOrderChangeIdempotencyKey,
  getOrderAmendmentFacts,
  POINT75_CORE_RPC_CONTRACT,
  POINT75_CORE_PREREQUISITE,
  requestOrderAmendment,
  requestOrderCancellation,
  requestOrderSubstitution,
} from "../orderAmendmentAuthorityClient";

const rpcMock = vi.hoisted(() => vi.fn());

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: rpcMock,
  },
}));

const baseFacts = {
  order_id: "order-1",
  order_number: "SO-2026-000001",
  order_status: "confirmed",
  commercial_version_id: "version-1",
  commercial_version_number: 1,
  frozen_sales_order_value: 10000,
  finance_status: "cleared",
  production_cutoff_reached: false,
  packing_cutoff_reached: false,
  dispatch_cutoff_reached: false,
  amendment_allowed: true,
  cancellation_allowed: true,
  substitution_allowed: true,
  blockers: [],
};

describe("orderAmendmentAuthorityClient (Point 75)", () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it("declares Core prerequisite when amendment facts RPC is absent", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: "Could not find the function public.get_order_amendment_facts_v1", code: "PGRST202" },
    });

    await expect(getOrderAmendmentFacts("order-1")).rejects.toThrow("Core prerequisite blocked");
    await expect(getOrderAmendmentFacts("order-1")).rejects.toThrow(POINT75_CORE_PREREQUISITE);
  });

  it("calls get_order_amendment_facts_v1 and parses governed facts", async () => {
    rpcMock.mockResolvedValue({ data: [baseFacts], error: null });

    const facts = await getOrderAmendmentFacts("order-1");
    expect(rpcMock).toHaveBeenCalledWith(POINT75_CORE_RPC_CONTRACT.getFacts, { p_order_id: "order-1" });
    expect(facts.orderId).toBe("order-1");
    expect(facts.commercialVersionId).toBe("version-1");
    expect(facts.amendmentAllowed).toBe(true);
  });

  it("calls request_order_amendment_v1 with version, actor, reason and line changes", async () => {
    rpcMock.mockResolvedValue({
      data: {
        ok: true,
        order_id: "order-1",
        change_id: "change-1",
        previous_status: "confirmed",
        new_status: "confirmed",
        previous_commercial_version_id: "version-1",
        new_commercial_version_id: "version-2",
      },
      error: null,
    });

    const result = await requestOrderAmendment({
      orderId: "order-1",
      commercialVersionId: "version-1",
      expectedOrderStatus: "confirmed",
      reason: "Customer requested qty reduction",
      evidenceReference: "evidence-1",
      lineChanges: [{ orderItemId: "line-1", newQuantity: 8 }],
      sourceChannel: "CENTRAL",
      sourceReference: "order-trace:SO-1",
      correlationId: "corr-1",
      idempotencyKey: "idem-1",
      actorId: "actor-1",
    });

    expect(rpcMock).toHaveBeenCalledWith(POINT75_CORE_RPC_CONTRACT.requestAmendment, {
      p_order_id: "order-1",
      p_commercial_version_id: "version-1",
      p_expected_order_status: "confirmed",
      p_reason: "Customer requested qty reduction",
      p_evidence_reference: "evidence-1",
      p_line_changes: [{ order_item_id: "line-1", new_quantity: 8, remove: false }],
      p_source_channel: "CENTRAL",
      p_source_reference: "order-trace:SO-1",
      p_correlation_id: "corr-1",
      p_idempotency_key: "idem-1",
      p_actor_id: "actor-1",
    });
    expect(result.ok).toBe(true);
    expect(result.newCommercialVersionId).toBe("version-2");
  });

  it("surfaces stale-version blockers from amendment RPC", async () => {
    rpcMock.mockResolvedValue({
      data: {
        ok: false,
        blockers: [{ code: "stale_commercial_version", message: "Commercial version mismatch" }],
      },
      error: null,
    });

    await expect(
      requestOrderAmendment({
        orderId: "order-1",
        commercialVersionId: "version-stale",
        expectedOrderStatus: "confirmed",
        reason: "Qty change",
        evidenceReference: "evidence-1",
        lineChanges: [{ orderItemId: "line-1", newQuantity: 5 }],
        sourceChannel: "CENTRAL",
        sourceReference: "order-trace:SO-1",
        correlationId: "corr-1",
        idempotencyKey: "idem-1",
        actorId: "actor-1",
      }),
    ).rejects.toThrow("Commercial version mismatch");
  });

  it("calls request_order_cancellation_v1 with idempotency identity", async () => {
    rpcMock.mockResolvedValue({
      data: { ok: true, order_id: "order-1", new_status: "cancelled", already_applied: true },
      error: null,
    });

    const result = await requestOrderCancellation({
      orderId: "order-1",
      commercialVersionId: "version-1",
      expectedOrderStatus: "confirmed",
      reason: "Customer cancelled before production",
      evidenceReference: "evidence-2",
      sourceChannel: "CENTRAL",
      sourceReference: "order-trace:SO-1",
      correlationId: "corr-cancel",
      idempotencyKey: "idem-cancel",
      actorId: "actor-1",
    });

    expect(rpcMock).toHaveBeenCalledWith(POINT75_CORE_RPC_CONTRACT.requestCancellation, {
      p_order_id: "order-1",
      p_commercial_version_id: "version-1",
      p_expected_order_status: "confirmed",
      p_reason: "Customer cancelled before production",
      p_evidence_reference: "evidence-2",
      p_source_channel: "CENTRAL",
      p_source_reference: "order-trace:SO-1",
      p_correlation_id: "corr-cancel",
      p_idempotency_key: "idem-cancel",
      p_actor_id: "actor-1",
    });
    expect(result.alreadyApplied).toBe(true);
  });

  it("calls request_order_substitution_v1 with line and replacement identity", async () => {
    rpcMock.mockResolvedValue({
      data: { ok: true, order_id: "order-1", change_id: "sub-1" },
      error: null,
    });

    await requestOrderSubstitution({
      orderId: "order-1",
      commercialVersionId: "version-1",
      expectedOrderStatus: "in_production",
      orderItemId: "line-1",
      replacementProductId: "product-2",
      newQuantity: 12,
      reason: "Approved substitute SKU",
      evidenceReference: "evidence-3",
      customerApprovalReference: "wa-msg-99",
      sourceChannel: "CENTRAL",
      sourceReference: "order-trace:SO-1",
      correlationId: "corr-sub",
      idempotencyKey: "idem-sub",
      actorId: "actor-1",
    });

    expect(rpcMock).toHaveBeenCalledWith(POINT75_CORE_RPC_CONTRACT.requestSubstitution, {
      p_order_id: "order-1",
      p_commercial_version_id: "version-1",
      p_expected_order_status: "in_production",
      p_order_item_id: "line-1",
      p_replacement_product_id: "product-2",
      p_new_quantity: 12,
      p_reason: "Approved substitute SKU",
      p_evidence_reference: "evidence-3",
      p_customer_approval_reference: "wa-msg-99",
      p_source_channel: "CENTRAL",
      p_source_reference: "order-trace:SO-1",
      p_correlation_id: "corr-sub",
      p_idempotency_key: "idem-sub",
      p_actor_id: "actor-1",
    });
  });

  it("builds deterministic idempotency and correlation keys", async () => {
    const identity = buildOrderChangeDecisionIdentity({
      orderId: "order-1",
      action: "cancel",
      commercialVersionId: "version-1",
      reason: "duplicate",
    });
    const idemA = await buildOrderChangeIdempotencyKey("cancel", identity);
    const idemB = await buildOrderChangeIdempotencyKey("cancel", identity);
    const corrA = await buildOrderChangeCorrelationId("cancel", identity);
    const corrB = await buildOrderChangeCorrelationId("cancel", identity);
    expect(idemA).toBe(idemB);
    expect(corrA).toBe(corrB);
    expect(idemA).toContain("central:point75:cancel:");
  });

  it("invokes rpc with the Supabase client as receiver", async () => {
    rpcMock.mockImplementation(function (
      this: { rpc: typeof rpcMock },
      fn: string,
      args?: Record<string, unknown>,
    ) {
      expect(this).toBeDefined();
      expect(this.rpc).toBe(rpcMock);
      expect(fn).toBe(POINT75_CORE_RPC_CONTRACT.getFacts);
      expect(args).toEqual({ p_order_id: "order-1" });
      return Promise.resolve({ data: [baseFacts], error: null });
    });

    await getOrderAmendmentFacts("order-1");
  });
});
