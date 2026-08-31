import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildFinanceOperationsCorrelationId,
  buildFinanceOperationsDecisionIdentity,
  buildFinanceOperationsIdempotencyKey,
  parseFinanceOperationsClearanceFacts,
} from "../financeClearanceAuthorityClient";

const source = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), "src", relativePath), "utf8");

describe("PF-6C Central Finance Operations Clearance contract", () => {
  const facts = {
    order_id: "order-1",
    company_id: "company-1",
    pi_id: "pi-1",
    commercial_version_id: "version-1",
    commercial_value: 10000,
    required_advance: 3000,
    verified_payment_amount: 2000,
    wallet_applied_amount: 500,
    approved_credit_amount: 500,
    covered_amount: 3000,
    eligible_for_operations_clearance: true,
    latest_clearance_event_id: null,
    latest_clearance_decision: null,
    payment_verified_is_not_clearance: true,
  };

  it("parses clearance facts only when payment verification remains separate", () => {
    const parsed = parseFinanceOperationsClearanceFacts(facts);
    expect(parsed.orderId).toBe("order-1");
    expect(parsed.requiredAdvance).toBe(3000);
    expect(parsed.coveredAmount).toBe(3000);
    expect(parsed.eligibleForOperationsClearance).toBe(true);
    expect(() => parseFinanceOperationsClearanceFacts({ ...facts, payment_verified_is_not_clearance: false }))
      .toThrow("payment-verification separation");
    expect(() => parseFinanceOperationsClearanceFacts({ ...facts, pi_id: null })).toThrow();
  });

  it("builds deterministic bounded decision identities", async () => {
    const parsed = parseFinanceOperationsClearanceFacts(facts);
    const identity = buildFinanceOperationsDecisionIdentity(
      parsed,
      "GRANTED",
      "Finance review approved Operations Clearance",
      "core-finance-facts:pi-1:version-1",
    );
    expect(await buildFinanceOperationsIdempotencyKey(identity)).toMatch(/^central:pf6c:operations:[0-9a-f]{64}$/);
    expect(await buildFinanceOperationsCorrelationId(identity)).toMatch(/^central:pf6c:operations:[0-9a-f]{64}$/);
    expect(await buildFinanceOperationsIdempotencyKey(identity)).toBe(await buildFinanceOperationsIdempotencyKey(identity));
  });

  it("exposes only the canonical PF-6C Core RPCs", () => {
    const client = source("lib/order-authority/financeClearanceAuthorityClient.ts");
    expect(client).toContain("get_finance_operations_clearance_facts_v1");
    expect(client).toContain("decide_finance_operations_clearance_v1");
    expect(client).toContain("payment_verified_is_not_clearance");
    expect(client).not.toContain('from("finance_clearance_events")');
    expect(client).not.toContain('from("orders").update');
  });

  it("gates every Central manufacturing/production release through PF-6C", () => {
    const authority = source("lib/order-authority/orderAuthorityClient.ts");
    expect(authority).toContain("ensureFinanceOperationsClearance(orderId)");
    expect(authority).toContain("getFinanceOperationsClearanceFacts");
    expect(authority).toContain("decideFinanceOperationsClearance");
    expect(authority).toContain("eligibleForOperationsClearance");
    expect(authority).toContain("latestClearanceDecision === \"GRANTED\"");

    const manufacturing = authority.slice(
      authority.indexOf("export async function releaseOrderToManufacturing"),
      authority.indexOf("export async function releaseOrderToInProduction"),
    );
    const production = authority.slice(
      authority.indexOf("export async function releaseOrderToInProduction"),
      authority.indexOf("export async function updateOrderFinanceVerification"),
    );
    for (const release of [manufacturing, production]) {
      expect(release).toContain("await ensureFinanceOperationsClearance(orderId)");
      expect(release).not.toContain("p_payment_status");
      expect(release).not.toContain("p_advance_paid");
      expect(release).not.toContain("p_sales_order_value");
    }
  });

  it("keeps payment verification distinct from the release decision", () => {
    const board = source("pages/admin/FinanceReleaseBoard.tsx");
    const orderAuthority = source("lib/order-authority/orderAuthorityClient.ts");
    expect(board).toContain("verifyPayment");
    expect(board).toContain("releaseOrderToInProduction");
    expect(orderAuthority).toContain("Finance Operations Clearance blocked");
    expect(orderAuthority).toContain("Finance review approved Operations Clearance");
  });
});
