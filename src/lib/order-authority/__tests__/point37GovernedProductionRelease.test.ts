import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  governedOrderActionDisabledReason,
  isGovernedOrderActionAvailable,
} from "@/utils/governedOrderActions";

const {
  rpcMock,
  getUserMock,
  resolvePaymentBindingMock,
  getFinanceOperationsClearanceFactsMock,
  decideFinanceOperationsClearanceMock,
} = vi.hoisted(() => ({
  rpcMock: vi.fn(),
  getUserMock: vi.fn(),
  resolvePaymentBindingMock: vi.fn(),
  getFinanceOperationsClearanceFactsMock: vi.fn(),
  decideFinanceOperationsClearanceMock: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: rpcMock,
    auth: { getUser: getUserMock },
  },
}));

vi.mock("@/lib/order-authority/paymentAuthorityClient", () => ({
  resolvePaymentBinding: resolvePaymentBindingMock,
}));

vi.mock("@/lib/order-authority/financeClearanceAuthorityClient", () => ({
  getFinanceOperationsClearanceFacts: getFinanceOperationsClearanceFactsMock,
  decideFinanceOperationsClearance: decideFinanceOperationsClearanceMock,
  buildFinanceOperationsDecisionIdentity: vi.fn(() => "identity"),
  buildFinanceOperationsCorrelationId: vi.fn(async () => "correlation"),
  buildFinanceOperationsIdempotencyKey: vi.fn(async () => "idempotency"),
}));

import { releaseOrderToInProduction } from "../orderAuthorityClient";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const clearanceFacts = {
  orderId: "order-confirmed-1",
  companyId: "company-1",
  piId: "pi-1",
  commercialVersionId: "version-1",
  commercialValue: 10000,
  requiredAdvance: 3000,
  verifiedPaymentAmount: 3000,
  walletAppliedAmount: 0,
  approvedCreditAmount: 0,
  coveredAmount: 3000,
  eligibleForOperationsClearance: true,
  latestClearanceEventId: null,
  latestClearanceDecision: null as string | null,
};

describe("Point 37 — governed production release closure", () => {
  beforeEach(() => {
    rpcMock.mockReset();
    getUserMock.mockReset();
    resolvePaymentBindingMock.mockReset();
    getFinanceOperationsClearanceFactsMock.mockReset();
    decideFinanceOperationsClearanceMock.mockReset();

    getUserMock.mockResolvedValue({ data: { user: { id: "finance-actor-1" } }, error: null });
    resolvePaymentBindingMock.mockResolvedValue({
      piId: "pi-1",
      commercialVersionId: "version-1",
    });
    getFinanceOperationsClearanceFactsMock.mockResolvedValue({ ...clearanceFacts });
    decideFinanceOperationsClearanceMock.mockResolvedValue({ ok: true });
  });

  describe("Order Management policy (confirmed → in_production)", () => {
    it("enables Send to Factory for confirmed orders", () => {
      expect(isGovernedOrderActionAvailable("confirmed", "in_production")).toBe(true);
      expect(governedOrderActionDisabledReason("confirmed", "in_production")).toBe("");
    });

    it("still blocks legacy manufacturing transition", () => {
      expect(isGovernedOrderActionAvailable("confirmed", "manufacturing")).toBe(false);
    });

    it("routes confirmed status to in_production in STATUS_FLOW", () => {
      const page = source("src/pages/admin/OrderManagement.tsx");
      expect(page).toMatch(/status:\s*"confirmed"(?:(?!status:)[\s\S])*?next:\s*"in_production"/);
    });
  });

  describe("PF-6C authority chain (releaseOrderToInProduction)", () => {
    it("auto-grants Finance Operations Clearance then calls release_order_to_in_production_v1", async () => {
      rpcMock.mockResolvedValue({
        data: {
          ok: true,
          order_id: "order-confirmed-1",
          previous_status: "confirmed",
          new_status: "in_production",
        },
        error: null,
      });

      const result = await releaseOrderToInProduction("order-confirmed-1");

      expect(decideFinanceOperationsClearanceMock).toHaveBeenCalledTimes(1);
      expect(rpcMock).toHaveBeenCalledWith("release_order_to_in_production_v1", {
        p_order_id: "order-confirmed-1",
      });
      expect(result.ok).toBe(true);
      expect(result.new_status).toBe("in_production");
    });

    it("skips clearance decision when PF-6C already GRANTED", async () => {
      getFinanceOperationsClearanceFactsMock.mockResolvedValue({
        ...clearanceFacts,
        latestClearanceDecision: "GRANTED",
      });
      rpcMock.mockResolvedValue({
        data: { ok: true, order_id: "order-confirmed-1", new_status: "in_production" },
        error: null,
      });

      await releaseOrderToInProduction("order-confirmed-1");

      expect(decideFinanceOperationsClearanceMock).not.toHaveBeenCalled();
      expect(rpcMock).toHaveBeenCalledWith("release_order_to_in_production_v1", {
        p_order_id: "order-confirmed-1",
      });
    });

    it("fails closed when PF-6C coverage is insufficient", async () => {
      getFinanceOperationsClearanceFactsMock.mockResolvedValue({
        ...clearanceFacts,
        coveredAmount: 1000,
        eligibleForOperationsClearance: false,
      });

      await expect(releaseOrderToInProduction("order-confirmed-1")).rejects.toThrow(
        "Finance Operations Clearance blocked",
      );
      expect(rpcMock).not.toHaveBeenCalled();
    });

    it("surfaces Core blockers from release_order_to_in_production_v1", async () => {
      rpcMock.mockResolvedValue({
        data: {
          ok: false,
          blockers: [{ code: "production_blocked", message: "Production release denied by Core" }],
        },
        error: null,
      });

      await expect(releaseOrderToInProduction("order-confirmed-1")).rejects.toThrow(
        "Production release denied by Core",
      );
    });

    it("does not pass legacy payment fields to the governed RPC", () => {
      const authority = source("src/lib/order-authority/orderAuthorityClient.ts");
      const production = authority.slice(
        authority.indexOf("export async function releaseOrderToInProduction"),
        authority.indexOf("export async function updateOrderFinanceVerification"),
      );
      expect(production).toContain("release_order_to_in_production_v1");
      expect(production).not.toContain("p_payment_status");
      expect(production).toContain("await ensureFinanceOperationsClearance(orderId)");
    });
  });
});
