import { join } from "node:path";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  allowsCommercialMutation,
  AUTONOMY_PACKET_BATCH_SIZE,
  buildOperatorExceptionNarrative,
  classifyClarificationHealth,
  createFailedAutonomyView,
  createReadyAutonomyView,
  enrichClarificationHealthFromSnapshot,
  fetchPacketAutonomyViews,
  latestAutonomyByPacket,
  packetRequiresOperatorAttention,
  requiresAcceptRouting,
  requiresHumanAiConclusionDecision,
  type PacketAutonomyView,
  type WhatsAppOrderAutonomyDecision,
} from "../orderAutonomy";
import {
  loadPacketAutonomyViewsIncremental,
  packetIdsNeedingAutonomyFetch,
} from "../orderAutonomyCache";
import { loadOperatorDecisionDeskState } from "../operatorDecisionDeskLoad";

function decision(
  overrides: Partial<WhatsAppOrderAutonomyDecision> = {},
): WhatsAppOrderAutonomyDecision {
  return {
    id: "d1",
    packetId: "p1",
    caseId: "c1",
    potentialOrderId: "po1",
    interpretationId: "i1",
    outcome: "AUTO_ELIGIBLE",
    decisionReasons: [],
    blockingReasons: [],
    governedFacts: {
      customer: { business_name: "Al Noor Trading" },
      lines: [{ sku: "PISTA-500", quantity: 12, unit: "carton" }],
    },
    readinessSnapshot: {},
    evaluatedAt: "2026-08-24T10:00:00Z",
    draftStatus: "PROMOTED",
    draftBlockingReason: null,
    salesOrderDraftId: "draft-1",
    promotedOrderId: "so-1",
    ...overrides,
  };
}

function readyView(
  packetId: string,
  decisionValue: WhatsAppOrderAutonomyDecision | null,
  overrides: Partial<PacketAutonomyView> = {},
): PacketAutonomyView {
  return {
    packetId,
    readState: "READY",
    executionReadState: decisionValue?.outcome === "AUTO_ELIGIBLE" ? "READY" : "NOT_APPLICABLE",
    decision: decisionValue,
    readError: null,
    executionReadError: null,
    clarificationHealth: "UNKNOWN",
    ...overrides,
  };
}

function mockSupabaseQuery(rows: unknown[], error: { message: string } | null = null) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data: rows, error }),
  };
  return {
    from: vi.fn().mockReturnValue(chain),
    rpc: vi.fn(),
  } as unknown as SupabaseClient;
}

describe("WhatsApp order autonomy operator model", () => {
  it("1. classifies every loaded packet when more than 200 packet IDs are requested", async () => {
    const packetIds = Array.from({ length: 250 }, (_, index) => `packet-${index}`);
    const rows = packetIds.map((packetId, index) => ({
      id: `decision-${index}`,
      packet_id: packetId,
      case_id: null,
      potential_order_id: null,
      interpretation_id: `interp-${index}`,
      autonomy_outcome: "HUMAN_EXCEPTION_REQUIRED",
      decision_reasons: [],
      blocking_reasons: [],
      evaluated_at: "2026-08-24T10:00:00Z",
    }));

    let inCalls = 0;
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        in: vi.fn((column: string, values: string[]) => {
          inCalls += 1;
          expect(column).toBe("packet_id");
          expect(values.length).toBeLessThanOrEqual(AUTONOMY_PACKET_BATCH_SIZE);
          const matched = rows.filter((row) => values.includes(row.packet_id));
          return {
            order: vi.fn().mockResolvedValue({ data: matched, error: null }),
          };
        }),
      })),
    } as unknown as SupabaseClient;

    const views = await fetchPacketAutonomyViews(supabase, packetIds);
    expect(views.size).toBe(250);
    expect(inCalls).toBeGreaterThan(2);
    for (const packetId of packetIds) {
      expect(views.get(packetId)?.readState).toBe("READY");
      expect(views.get(packetId)?.decision?.packetId).toBe(packetId);
    }
  });

  it("2. treats decision lookup failure differently from a missing decision", async () => {
    const supabase = mockSupabaseQuery([], { message: "permission denied" });
    const views = await fetchPacketAutonomyViews(supabase, ["p1"]);
    const failed = views.get("p1");
    expect(failed?.readState).toBe("FAILED");
    expect(failed?.decision).toBeNull();

    const missing = readyView("p2", null);
    expect(missing.readState).toBe("READY");
    expect(missing.decision).toBeNull();
    expect(failed?.readState).not.toBe(missing.readState);
  });

  it("3. exposes zero commercial mutation controls on decision lookup failure", () => {
    const failed = createFailedAutonomyView("p1", "lookup failed");
    expect(allowsCommercialMutation(failed)).toBe(false);
    expect(requiresHumanAiConclusionDecision(failed)).toBe(false);
    expect(requiresAcceptRouting(failed)).toBe(false);
  });

  it("4. exposes zero commercial mutation controls on execution lookup failure", () => {
    const view = readyView("p1", decision({ draftStatus: null }), {
      executionReadState: "FAILED",
      executionReadError: "execution lookup failed",
    });
    expect(allowsCommercialMutation(view)).toBe(false);
    expect(requiresAcceptRouting(view)).toBe(false);
  });

  it("5. does not hide AUTO_ELIGIBLE with unknown execution state as auto-success", () => {
    const view = readyView("p1", decision({ draftStatus: null }), { executionReadState: "FAILED" });
    expect(packetRequiresOperatorAttention(view)).toBe(true);
    const loading = readyView("p1", decision({ draftStatus: null }), { executionReadState: "LOADING" });
    expect(packetRequiresOperatorAttention(loading)).toBe(true);
  });

  it("6. hides PROMOTED auto-success from the default exception queue", () => {
    const view = readyView("p1", decision({ draftStatus: "PROMOTED" }));
    expect(packetRequiresOperatorAttention(view)).toBe(false);
  });

  it("7. keeps PROMOTION_BLOCKED visible in the exception queue", () => {
    const view = readyView("p1", decision({
      draftStatus: "PROMOTION_BLOCKED",
      draftBlockingReason: "customer_company_credit_frozen",
    }));
    expect(packetRequiresOperatorAttention(view)).toBe(true);
  });

  it("8. keeps REJECTED_NOT_ELIGIBLE visible in the exception queue", () => {
    const view = readyView("p1", decision({ draftStatus: "REJECTED_NOT_ELIGIBLE" }));
    expect(packetRequiresOperatorAttention(view)).toBe(true);
  });

  it("9. does not expose Accept routing for CLARIFICATION_REQUIRED", () => {
    const view = readyView("p1", decision({
      outcome: "CLARIFICATION_REQUIRED",
      draftStatus: null,
    }));
    expect(requiresAcceptRouting(view)).toBe(false);
    expect(requiresHumanAiConclusionDecision(view)).toBe(false);
  });

  it("10. shows healthy CORE-C clarification as automation/waiting state", () => {
    const health = classifyClarificationHealth({
      caseStatus: "AWAITING_CUSTOMER",
      clarifications: [{ status: "OPEN", due_at: "2026-12-31T00:00:00Z" }],
      escalations: [],
      outboundDecisions: [{ status: "RELEASED", related_clarification_id: "clar-1" }],
    });
    expect(health).toBe("AUTOMATION_ACTIVE");
    const view = readyView("p1", decision({
      outcome: "CLARIFICATION_REQUIRED",
      draftStatus: null,
    }), { clarificationHealth: "AUTOMATION_ACTIVE" });
    expect(packetRequiresOperatorAttention(view)).toBe(false);
    const narrative = buildOperatorExceptionNarrative(view, "Need quantity");
    expect(narrative.queueLabel).toBe("Waiting for customer");
    expect(narrative.whatHappensNext).toContain("Core automation");
  });

  it("11. keeps blocked CORE-C clarification visible as an exception", () => {
    const health = classifyClarificationHealth({
      caseStatus: "OPEN",
      clarifications: [{ status: "OPEN", due_at: "2020-01-01T00:00:00Z" }],
      escalations: [],
      outboundDecisions: [],
    });
    expect(health).toBe("BLOCKED");
    const view = readyView("p1", decision({
      outcome: "CLARIFICATION_REQUIRED",
      draftStatus: null,
    }), { clarificationHealth: "BLOCKED" });
    expect(packetRequiresOperatorAttention(view)).toBe(true);
    expect(buildOperatorExceptionNarrative(view).queueLabel).toBe("Clarification blocked");
  });

  it("12. prevents stale packet A response from overwriting packet B in desk load guard contract", async () => {
    const packetA = "packet-a";
    const packetB = "packet-b";
    let resolveA: (value: unknown) => void = () => {};
    const delayedSnapshot = new Promise((resolve) => { resolveA = resolve; });

    const supabase = {
      rpc: vi.fn((name: string, args: Record<string, unknown>) => {
        if (name === "whatsapp_get_case_decision_snapshot" && args.p_packet_id === packetA) {
          return delayedSnapshot;
        }
        return Promise.resolve({
          data: {
            packet_id: args.p_packet_id,
            case: { id: "case-b", packet_id: packetB, case_type: "ORDER", status: "OPEN", accountability_status: "UNASSIGNED", rule_version: "v1" },
            clarifications: [],
            escalations: [],
            outbound_decisions: [],
            identities: [],
            recipient_authorizations: [],
            department_tasks: [],
            milestones: [],
            events: [],
            latest_ai: null,
            closure: null,
          },
          error: null,
        });
      }),
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      })),
    } as unknown as SupabaseClient;

    const activePacketIdRef = { current: packetA };
    const loadFor = async (targetPacketId: string) => {
      const loaded = await loadOperatorDecisionDeskState(supabase, targetPacketId);
      if (activePacketIdRef.current !== targetPacketId) return null;
      return loaded;
    };

    const pendingA = loadFor(packetA);
    activePacketIdRef.current = packetB;
    const loadedB = await loadFor(packetB);
    expect(loadedB?.snapshot.packetId).toBe(packetB);

    resolveA({
      data: {
        packet_id: packetA,
        case: { id: "case-a", packet_id: packetA, case_type: "ORDER", status: "OPEN", accountability_status: "UNASSIGNED", rule_version: "v1" },
        clarifications: [],
        escalations: [],
        outbound_decisions: [],
        identities: [],
        recipient_authorizations: [],
        department_tasks: [],
        milestones: [],
        events: [],
        latest_ai: null,
        closure: null,
      },
      error: null,
    });
    const loadedA = await pendingA;
    expect(loadedA).toBeNull();
    expect(activePacketIdRef.current).toBe(packetB);
  });

  it("13. incremental packet load does not refetch cached packet IDs", () => {
    const cache = new Map<string, PacketAutonomyView>([
      ["p1", readyView("p1", decision())],
    ]);
    expect(packetIdsNeedingAutonomyFetch(["p1", "p2"], cache, false)).toEqual(["p2"]);
    expect(packetIdsNeedingAutonomyFetch(["p1", "p2"], cache, true)).toEqual(["p1", "p2"]);
  });

  it("14. explicit refresh revalidates previously cached Core state", async () => {
    const supabase = mockSupabaseQuery([
      {
        id: "d1",
        packet_id: "p1",
        case_id: null,
        potential_order_id: null,
        interpretation_id: "i1",
        autonomy_outcome: "AUTO_ELIGIBLE",
        decision_reasons: [],
        blocking_reasons: [],
        evaluated_at: "2026-08-24T10:00:00Z",
      },
    ]);
    const cache = new Map<string, PacketAutonomyView>([
      ["p1", createReadyAutonomyView("p1", decision({ outcome: "HUMAN_EXCEPTION_REQUIRED" }))],
    ]);
    const refreshed = await loadPacketAutonomyViewsIncremental(supabase, ["p1"], cache, true);
    expect(refreshed.get("p1")?.decision?.outcome).toBe("AUTO_ELIGIBLE");
  });

  it("15. keeps missing decision after successful lookup visible as an exception", () => {
    const view = readyView("p1", null);
    expect(packetRequiresOperatorAttention(view)).toBe(true);
    expect(buildOperatorExceptionNarrative(view).queueLabel).toBe("Missing Core decision");
  });

  it("16. browser read model does not write Core autonomy ledgers", () => {
    const source = readFileSync(join(import.meta.dirname, "../orderAutonomy.ts"), "utf8");
    expect(source).not.toMatch(/\.(insert|update|delete|upsert)\(/);
  });

  it("17. does not offer ordinary ACCEPT/MODIFY/REJECT for clear automated orders", () => {
    const auto = readyView("p1", decision({ draftStatus: "DRAFT_CREATED" }));
    expect(requiresHumanAiConclusionDecision(auto)).toBe(false);
    expect(requiresAcceptRouting(auto)).toBe(false);
    expect(allowsCommercialMutation(auto)).toBe(false);
  });

  it("keeps the latest Core decision per packet deterministically", () => {
    const map = latestAutonomyByPacket([
      decision({ id: "old", evaluatedAt: "2026-08-24T09:00:00Z", outcome: "CLARIFICATION_REQUIRED" }),
      decision({ id: "new", evaluatedAt: "2026-08-24T11:00:00Z", outcome: "AUTO_ELIGIBLE" }),
    ]);
    expect(map.get("p1")?.id).toBe("new");
    expect(map.get("p1")?.outcome).toBe("AUTO_ELIGIBLE");
  });

  it("builds a plain-language narrative without confidence jargon", () => {
    const narrative = buildOperatorExceptionNarrative(
      readyView("p1", decision({
        outcome: "CLARIFICATION_REQUIRED",
        draftStatus: null,
        blockingReasons: ["unresolved_customer", "missing_explicit_quantity_line_1"],
      })),
      "Customer may want baklawa",
    );
    expect(narrative.who).toBe("Al Noor Trading");
    expect(narrative.whatTheyWant).toContain("PISTA-500");
    expect(narrative.whatAiUnderstood).toBe("Customer may want baklawa");
    expect(narrative.whatIsBlocked).toContain("Customer is not uniquely identified");
    expect(JSON.stringify(narrative).toLowerCase()).not.toContain("p95");
  });

  it("enriches clarification health from case snapshot evidence", () => {
    const health = enrichClarificationHealthFromSnapshot(
      {
        packetId: "p1",
        communicationCase: {
          id: "c1",
          packet_id: "p1",
          case_type: "ORDER",
          status: "AWAITING_CUSTOMER",
          company_id: null,
          sales_order_draft_id: null,
          accountable_team: null,
          accountable_owner_id: null,
          accountability_status: "UNASSIGNED",
          next_action: null,
          next_action_due_at: null,
          rule_version: "v1",
          closed_at: null,
        },
        latestAi: null,
        identities: [],
        recipientAuthorizations: [],
        departmentTasks: [],
        clarifications: [{ status: "OPEN", due_at: "2026-12-31T00:00:00Z" }],
        escalations: [],
        outboundDecisions: [{ status: "RELEASED", related_clarification_id: "clar-1" }],
        milestones: [],
        closure: null,
        events: [],
      },
      decision({ outcome: "CLARIFICATION_REQUIRED" }),
    );
    expect(health).toBe("AUTOMATION_ACTIVE");
  });
});
