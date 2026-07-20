import { describe, expect, it } from "vitest";
import {
  summarizeOperatorInboxAccountability,
  type OperatorInboxAccountabilityItem,
} from "@/components/whatsapp/useOperatorInboxAccountability";

function item(overrides: Partial<OperatorInboxAccountabilityItem> = {}): OperatorInboxAccountabilityItem {
  return {
    item_source: "CURRENT_CAPTURE_EXCEPTION",
    source_record_id: "record-1",
    source_message_id: "message-1",
    existing_intake_id: null,
    provider_message_id: "wamid-1",
    provider: "meta_whatsapp",
    receiver_channel_id: "channel-1",
    accountability_state: "RECEIVER_ID_MISSING",
    effective_disposition: "ACTIVE_PENDING",
    assigned_team: "B2B_SALES",
    effective_next_action: "Verify receiver identity",
    closure_reason: null,
    evidence: {},
    detected_at: "2026-07-19T00:00:00.000Z",
    resolved_at: null,
    priority_rank: 10,
    ...overrides,
  };
}

describe("summarizeOperatorInboxAccountability", () => {
  const now = Date.parse("2026-07-20T12:00:00.000Z");

  it("counts unresolved, critical, stale, unowned, and actionless records", () => {
    const result = summarizeOperatorInboxAccountability(
      [
        item(),
        item({
          source_record_id: "record-2",
          source_message_id: "message-2",
          assigned_team: " ",
          effective_next_action: null,
          priority_rank: 80,
          detected_at: "2026-07-20T11:30:00.000Z",
        }),
      ],
      now,
    );

    expect(result).toEqual({ total: 2, critical: 1, unowned: 1, actionless: 1, stale: 1 });
  });

  it("does not count invalid timestamps as stale", () => {
    expect(summarizeOperatorInboxAccountability([item({ detected_at: "invalid" })], now).stale).toBe(0);
  });

  it("is deterministic and does not mutate source items", () => {
    const rows = [item()];
    const before = structuredClone(rows);
    expect(summarizeOperatorInboxAccountability(rows, now)).toEqual(
      summarizeOperatorInboxAccountability(rows, now),
    );
    expect(rows).toEqual(before);
  });
});
