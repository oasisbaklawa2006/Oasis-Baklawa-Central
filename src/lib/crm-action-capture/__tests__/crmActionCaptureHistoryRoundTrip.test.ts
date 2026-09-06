import { describe, expect, it } from "vitest";
import { buildCommunicationHistoryFromClientInteractions } from "@/lib/crm-communication-history/crmCommunicationHistoryNormalizer";
import type { ClientInteractionRow } from "@/lib/crm-communication-history/crmCommunicationHistoryTypes";
import { buildPoint62ProvenanceMarker, buildCapturedNotes } from "../crmActionCaptureProvenance";

const companyId = "11111111-1111-4111-8111-111111111111";

describe("Point62 → Point61 history round-trip", () => {
  it("projects governed capture rows into communication history with stripped provenance", () => {
    const marker = buildPoint62ProvenanceMarker({
      source: "central_customer360",
      channel: "call",
      phase: "result",
      idempotencyKey: "idem-roundtrip",
    });
    const row: ClientInteractionRow = {
      id: "row-1",
      company_id: companyId,
      executive_id: "exec-1",
      interaction_type: "call",
      notes: buildCapturedNotes(marker, "Discussed credit terms"),
      outcome: "recorded",
      follow_up_date: null,
      created_at: "2026-09-06T09:00:00.000Z",
    };

    const entries = buildCommunicationHistoryFromClientInteractions([row], companyId);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.detail).toBe("Discussed credit terms");
    expect(entries[0]?.channel).toBe("call");
    expect(entries[0]?.source.authority).toBe("client_interactions");
    expect(entries[0]?.actor.role).toBe("sales_executive");
  });

  it("preserves email intent-only outcome without delivery claims", () => {
    const marker = buildPoint62ProvenanceMarker({
      source: "central_customer360",
      channel: "email",
      phase: "result",
      idempotencyKey: "idem-email",
    });
    const row: ClientInteractionRow = {
      id: "row-email",
      company_id: companyId,
      executive_id: "exec-1",
      interaction_type: "email",
      notes: buildCapturedNotes(marker, "Subject: PI\nIntent recorded only"),
      outcome: "intent_recorded",
      follow_up_date: null,
      created_at: "2026-09-06T09:05:00.000Z",
    };

    const entries = buildCommunicationHistoryFromClientInteractions([row], companyId);
    expect(entries[0]?.channel).toBe("email");
    expect(entries[0]?.outcome).toBe("intent_recorded");
    expect(entries[0]?.direction).toBe("outbound");
  });
});
