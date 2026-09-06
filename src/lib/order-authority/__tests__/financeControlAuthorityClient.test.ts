import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  assertDualControl,
  assertSourceVersion,
  buildFinanceControlCorrelationId,
  buildFinanceControlIdempotencyKey,
  formatFinanceControlPrerequisite,
  parseFinanceControlFacts,
  FinanceControlAuthorityError,
} from "../financeControlAuthorityClient";
import {
  listCorePartialSurfaces,
  listPoint80Surfaces,
  listShadowSurfaces,
  POINT80_REQUIRED_CORE_RPCS,
} from "../financeControlSurfaceCensus";

const source = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), "src", relativePath), "utf8");

const digest = vi.fn(async () => new Uint8Array(32).buffer);

beforeAll(() => {
  vi.stubGlobal("crypto", { subtle: { digest } });
});
afterAll(() => vi.unstubAllGlobals());
beforeEach(() => digest.mockClear());

describe("Point 80 finance control surface census", () => {
  it("lists Point 80 surfaces separately from Point 78/79/81 lanes", () => {
    const point80 = listPoint80Surfaces();
    expect(point80.some((entry) => entry.separateFromPoint80 === "point78_payment_proof")).toBe(false);
    expect(point80.some((entry) => entry.separateFromPoint80 === "point79_wallet_credit")).toBe(false);
    expect(point80.some((entry) => entry.separateFromPoint80 === "point81_ageing_disputes")).toBe(false);
    expect(point80.some((entry) => entry.id === "pf6d.finance_hold.place")).toBe(true);
    expect(point80.some((entry) => entry.id === "pf6d.finance_second_approval.decide")).toBe(true);
  });

  it("marks shadow governance writes as blocked production authority", () => {
    const shadows = listShadowSurfaces();
    expect(shadows.some((entry) => entry.centralModule.includes("financeGovernanceService"))).toBe(true);
    expect(shadows.every((entry) => entry.coreRpcOrView === null)).toBe(true);
  });

  it("declares exact PF-6D Core prerequisites", () => {
    expect(POINT80_REQUIRED_CORE_RPCS).toEqual([
      "get_finance_control_facts_v1",
      "place_finance_hold_v1",
      "release_finance_hold_v1",
      "request_finance_reversal_v1",
      "complete_finance_reversal_v1",
      "request_finance_second_approval_v1",
      "decide_finance_second_approval_v1",
    ]);
    expect(listCorePartialSurfaces().every((entry) => entry.gapNote?.includes("Core RPC prerequisite"))).toBe(true);
  });
});

describe("Point 80 Central finance control authority contract", () => {
  const factsPayload = {
    order_id: "order-1",
    pi_id: "pi-1",
    commercial_version_id: "version-1",
    source_version: 3,
    open_hold_types: ["advance_unverified"],
    active_hold_event_ids: ["hold-1"],
    latest_release_decision: "GRANTED",
    pending_reversal_request_id: null,
    pending_second_approval_request_id: "approval-1",
    second_approval_required: true,
    control_facts_only: true,
  };

  it("parses Core finance control facts only when control_facts_only is true", () => {
    const parsed = parseFinanceControlFacts(factsPayload);
    expect(parsed.orderId).toBe("order-1");
    expect(parsed.sourceVersion).toBe(3);
    expect(parsed.openHoldTypes).toContain("advance_unverified");
    expect(parsed.secondApprovalRequired).toBe(true);
    expect(() => parseFinanceControlFacts({ ...factsPayload, control_facts_only: false })).toThrow(
      "control_facts_only",
    );
  });

  it("builds deterministic bounded identities", async () => {
    const identity = JSON.stringify(["order-1", "pi-1", "hold-1", "advance_unverified"]);
    expect(await buildFinanceControlIdempotencyKey("hold", identity)).toMatch(/^central:pf6d:hold:[0-9a-f]{64}$/);
    expect(await buildFinanceControlCorrelationId("hold", identity)).toMatch(/^central:pf6d:hold:[0-9a-f]{64}$/);
  });

  it("denies self-approval for dual-control completion", () => {
    expect(() => assertDualControl("actor-1", "actor-1")).toThrow(FinanceControlAuthorityError);
    expect(() => assertDualControl("actor-1", "actor-2")).not.toThrow();
  });

  it("denies stale source version mismatches", () => {
    expect(() => assertSourceVersion(3, 2)).toThrow("Stale finance control source version");
    expect(() => assertSourceVersion(3, 3)).not.toThrow();
  });

  it("formats exact Core prerequisites without shadow wording", () => {
    const message = formatFinanceControlPrerequisite(["place_finance_hold_v1", "release_finance_hold_v1"]);
    expect(message).toContain("place_finance_hold_v1");
    expect(message).toContain("oasis-supabase-core");
    expect(message).toContain("must not create shadow");
  });

  it("exposes only Core-backed PF-6D mutation RPCs in the authority client", () => {
    const client = source("lib/order-authority/financeControlAuthorityClient.ts");
    for (const rpc of POINT80_REQUIRED_CORE_RPCS) {
      expect(client, `missing canonical RPC reference ${rpc}`).toContain(rpc);
    }
    expect(client).toContain("decideFinanceOperationsClearance");
    expect(client).toContain("decideFinanceDispatchClearance");
    expect(client).not.toContain('from("finance_review_evidence").insert');
    expect(client).not.toContain('from("orders").update');
  });
});
