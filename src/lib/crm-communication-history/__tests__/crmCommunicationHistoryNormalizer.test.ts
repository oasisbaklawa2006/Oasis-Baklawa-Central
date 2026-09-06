import { describe, expect, it } from "vitest";
import {
  buildCommunicationHistoryFromClientInteractions,
  buildCrmCommunicationChannelGovernance,
  dedupeCommunicationHistoryEntries,
  inferActorRoleFromInteraction,
  inferDirectionFromInteraction,
  mapInteractionTypeToChannel,
  normalizeClientInteractionRow,
  sortCommunicationHistoryEntries,
} from "../crmCommunicationHistoryNormalizer";
import type { ClientInteractionRow, CrmCommunicationHistoryEntry } from "../crmCommunicationHistoryTypes";

const COMPANY_ID = "a1b2c3d4-e5f6-4789-a012-3456789abcde";

function interaction(overrides: Partial<ClientInteractionRow> = {}): ClientInteractionRow {
  return {
    id: "ci-1",
    company_id: COMPANY_ID,
    executive_id: "exec-1",
    interaction_type: "call",
    notes: "Discussed pricing",
    outcome: "positive",
    follow_up_date: null,
    created_at: "2026-03-01T10:00:00.000Z",
    ...overrides,
  };
}

describe("crmCommunicationHistoryNormalizer", () => {
  it("maps interaction types to channels", () => {
    expect(mapInteractionTypeToChannel("call")).toBe("call");
    expect(mapInteractionTypeToChannel("whatsapp")).toBe("whatsapp");
    expect(mapInteractionTypeToChannel("email")).toBe("email");
    expect(mapInteractionTypeToChannel("")).toBe("unknown");
  });

  it("infers outbound direction for auto-logged WhatsApp rows", () => {
    const row = interaction({
      interaction_type: "whatsapp",
      notes: "[AUTO] Order update sent",
      executive_id: null,
    });
    expect(inferDirectionFromInteraction(row)).toBe("outbound");
    expect(inferActorRoleFromInteraction(row)).toBe("system");
  });

  it("fails closed on cross-company interaction rows", () => {
    const row = interaction({ company_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" });
    expect(normalizeClientInteractionRow(row, COMPANY_ID)).toBeNull();
  });

  it("preserves source attribution and raw record ids", () => {
    const entry = normalizeClientInteractionRow(interaction(), COMPANY_ID);
    expect(entry?.source).toEqual({
      authority: "client_interactions",
      table: "client_interactions",
      recordId: "ci-1",
    });
    expect(entry?.companyId).toBe(COMPANY_ID);
  });

  it("sorts entries newest-first with stable tie-breaker", () => {
    const older: CrmCommunicationHistoryEntry = {
      entryId: "ci:old",
      occurredAt: "2026-01-01T00:00:00.000Z",
      channel: "call",
      direction: "unknown",
      actor: { role: "unknown", executiveId: null, displayLabel: "Unknown actor" },
      summary: "Call",
      detail: null,
      outcome: null,
      followUpDate: null,
      source: { authority: "client_interactions", table: "client_interactions", recordId: "old" },
      companyId: COMPANY_ID,
    };
    const newer: CrmCommunicationHistoryEntry = {
      ...older,
      entryId: "ci:new",
      occurredAt: "2026-02-01T00:00:00.000Z",
      source: { authority: "client_interactions", table: "client_interactions", recordId: "new" },
    };
    expect(sortCommunicationHistoryEntries([older, newer])[0]?.entryId).toBe("ci:new");
  });

  it("dedupes by source table and record id", () => {
    const entry = normalizeClientInteractionRow(interaction(), COMPANY_ID)!;
    const duplicate = { ...entry, entryId: "ci:duplicate-label" };
    expect(dedupeCommunicationHistoryEntries([entry, duplicate])).toHaveLength(1);
  });

  it("builds company-scoped history from client_interactions only", () => {
    const rows = [
      interaction({ id: "ci-1", created_at: "2026-03-02T00:00:00.000Z" }),
      interaction({
        id: "ci-2",
        interaction_type: "whatsapp",
        notes: "[AUTO] Hello",
        created_at: "2026-03-03T00:00:00.000Z",
      }),
      interaction({
        id: "ci-3",
        company_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      }),
    ];
    const history = buildCommunicationHistoryFromClientInteractions(rows, COMPANY_ID);
    expect(history).toHaveLength(2);
    expect(history[0]?.entryId).toBe("ci:ci-2");
    expect(history[0]?.detail).toBe("Hello");
  });

  it("marks email channel as partial intent-only in governance metadata", () => {
    const channels = buildCrmCommunicationChannelGovernance();
    expect(channels.find((c) => c.channel === "email")?.availability).toBe("partial");
    expect(channels.find((c) => c.channel === "whatsapp")?.availability).toBe("partial");
  });
});
