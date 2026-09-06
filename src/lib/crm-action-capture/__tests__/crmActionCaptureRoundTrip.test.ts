import { describe, expect, it } from "vitest";
import { buildCommunicationHistoryFromClientInteractions } from "@/lib/crm-communication-history/crmCommunicationHistoryNormalizer";
import type { ClientInteractionRow } from "@/lib/crm-communication-history/crmCommunicationHistoryTypes";
import { buildCaptureRow } from "../crmActionCaptureClient";

const COMPANY_ID = "a1b2c3d4-e5f6-4789-a012-3456789abcde";
const EXEC_ID = "e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e1e1";

describe("Point62 → Point61 communication history round-trip", () => {
  it("projects governed capture rows into Point61 ledger with stripped detail", () => {
    const captured = buildCaptureRow({
      input: {
        companyId: COMPANY_ID,
        executiveId: EXEC_ID,
        channel: "promise",
        notes: "Will confirm MOQ by Tuesday",
        followUpDate: "2026-03-12",
        outcome: "pending confirmation",
      },
      deliveryState: "not_applicable",
      source: "manual",
      idempotencyKey: "round-trip-1",
    });

    const row: ClientInteractionRow = {
      id: "ci-p62-1",
      company_id: captured.company_id,
      executive_id: captured.executive_id,
      interaction_type: captured.interaction_type,
      notes: captured.notes,
      outcome: captured.outcome,
      follow_up_date: captured.follow_up_date,
      created_at: "2026-03-05T12:00:00.000Z",
    };

    const history = buildCommunicationHistoryFromClientInteractions([row], COMPANY_ID);
    expect(history).toHaveLength(1);
    expect(history[0]?.channel).toBe("promise");
    expect(history[0]?.detail).toBe("Will confirm MOQ by Tuesday");
    expect(history[0]?.followUpDate).toBe("2026-03-12");
    expect(history[0]?.source.authority).toBe("client_interactions");
    expect(history[0]?.source.recordId).toBe("ci-p62-1");
  });

  it("projects email intent-only rows without delivered disposition", () => {
    const captured = buildCaptureRow({
      input: {
        companyId: COMPANY_ID,
        executiveId: EXEC_ID,
        channel: "email",
        notes: "Subject: Quote\nPlease review pricing.",
      },
      deliveryState: "intent_only",
      source: "intent_only",
      idempotencyKey: "email-intent-1",
    });

    const history = buildCommunicationHistoryFromClientInteractions(
      [
        {
          id: "ci-email-1",
          company_id: captured.company_id,
          executive_id: captured.executive_id,
          interaction_type: captured.interaction_type,
          notes: captured.notes,
          outcome: captured.outcome,
          follow_up_date: null,
          created_at: "2026-03-05T12:00:00.000Z",
        },
      ],
      COMPANY_ID,
    );

    expect(history[0]?.channel).toBe("email");
    expect(history[0]?.outcome).toBe("intent_only");
    expect(history[0]?.direction).toBe("internal");
  });
});
