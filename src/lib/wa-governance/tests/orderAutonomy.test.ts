import { describe, expect, it } from "vitest";
import {
  buildOperatorExceptionNarrative,
  latestAutonomyByPacket,
  packetRequiresOperatorAttention,
  requiresAcceptRouting,
  requiresHumanAiConclusionDecision,
  type WhatsAppOrderAutonomyDecision,
} from "../orderAutonomy";

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

describe("WhatsApp order autonomy operator model", () => {
  it("hides clear AUTO_ELIGIBLE auto-success from the exception queue", () => {
    expect(packetRequiresOperatorAttention(decision())).toBe(false);
    expect(requiresHumanAiConclusionDecision(decision())).toBe(false);
    expect(requiresAcceptRouting(decision())).toBe(false);
  });

  it("keeps clarification, policy, failure, and blocked promotion in the exception queue", () => {
    expect(packetRequiresOperatorAttention(decision({
      outcome: "CLARIFICATION_REQUIRED",
      draftStatus: null,
      blockingReasons: ["missing_explicit_quantity_line_1"],
    }))).toBe(true);
    expect(packetRequiresOperatorAttention(decision({
      outcome: "POLICY_APPROVAL_REQUIRED",
      draftStatus: null,
      blockingReasons: ["below_moq_line_1"],
    }))).toBe(true);
    expect(packetRequiresOperatorAttention(decision({
      outcome: "FAILED_INTERPRETATION",
      draftStatus: null,
      blockingReasons: ["unclear_intent"],
    }))).toBe(true);
    expect(packetRequiresOperatorAttention(decision({
      outcome: "AUTO_ELIGIBLE",
      draftStatus: "PROMOTION_BLOCKED",
      draftBlockingReason: "customer_company_credit_frozen",
    }))).toBe(true);
    expect(packetRequiresOperatorAttention(null)).toBe(true);
  });

  it("does not treat browser-less AUTO_ELIGIBLE as needing ACCEPT/MODIFY/REJECT", () => {
    expect(requiresHumanAiConclusionDecision(decision({ draftStatus: "DRAFT_CREATED" }))).toBe(false);
    expect(requiresHumanAiConclusionDecision(decision({
      outcome: "HUMAN_EXCEPTION_REQUIRED",
      draftStatus: null,
    }))).toBe(true);
  });

  it("does not expose Accept routing for Core clarification", () => {
    expect(requiresAcceptRouting(decision({
      outcome: "CLARIFICATION_REQUIRED",
      draftStatus: null,
    }))).toBe(false);
    expect(requiresAcceptRouting(decision({
      outcome: "POLICY_APPROVAL_REQUIRED",
      draftStatus: null,
    }))).toBe(true);
  });

  it("builds a plain-language narrative without confidence jargon", () => {
    const narrative = buildOperatorExceptionNarrative(
      decision({
        outcome: "CLARIFICATION_REQUIRED",
        draftStatus: null,
        blockingReasons: ["unresolved_customer", "missing_explicit_quantity_line_1"],
      }),
      "Customer may want baklawa",
    );
    expect(narrative.who).toBe("Al Noor Trading");
    expect(narrative.whatTheyWant).toContain("PISTA-500");
    expect(narrative.whatAiUnderstood).toBe("Customer may want baklawa");
    expect(narrative.whatIsBlocked).toContain("Customer is not uniquely identified");
    expect(narrative.whatIsBlocked).toContain("explicit quantity");
    expect(narrative.whatHappensNext.toLowerCase()).not.toContain("confidence");
    expect(JSON.stringify(narrative).toLowerCase()).not.toContain("p95");
  });

  it("keeps the latest Core decision per packet", () => {
    const map = latestAutonomyByPacket([
      decision({ id: "old", evaluatedAt: "2026-08-24T09:00:00Z", outcome: "CLARIFICATION_REQUIRED" }),
      decision({ id: "new", evaluatedAt: "2026-08-24T11:00:00Z", outcome: "AUTO_ELIGIBLE" }),
    ]);
    expect(map.get("p1")?.id).toBe("new");
    expect(map.get("p1")?.outcome).toBe("AUTO_ELIGIBLE");
  });
});
