import { describe, it, expect } from "vitest";
import { normalizeWhatsAppEvents } from "@/lib/operational-events/normalize";
import { buildWhatsAppOperationalFeed } from "@/lib/operational-events/whatsappFeed";
import { deriveCustomerWaitingSignal } from "@/lib/operational-events/readOnlyOperationalSignals";
import type { OperatorInboxPacket } from "@/components/whatsapp/operatorInboxTypes";

describe("buildWhatsAppOperationalFeed", () => {
  it("emits inbound and outbound message projections", () => {
    const packet: OperatorInboxPacket = {
      id: "p1",
      contact_id: "c1",
      fragment_count: 2,
      status: "open",
      first_message_at: "2026-05-01T10:00:00.000Z",
      last_message_at: "2026-05-01T10:05:00.000Z",
      stitched_content: null,
      messages: [
        {
          id: "m1",
          content: "Hi",
          message_type: "text",
          direction: "inbound",
          created_at: "2026-05-01T10:00:00.000Z",
          packet_sequence: 1,
        },
        {
          id: "m2",
          content: "Hello",
          message_type: "text",
          direction: "outbound",
          created_at: "2026-05-01T10:05:00.000Z",
          packet_sequence: 2,
          provider: "operator_reply",
        },
      ],
    };
    const events = normalizeWhatsAppEvents(buildWhatsAppOperationalFeed({ packet, now: new Date("2026-05-01T11:00:00.000Z").getTime() }));
    const kinds = events.map((e) => e.kind);
    expect(kinds).toContain("whatsapp.message_received");
    expect(kinds).toContain("whatsapp.message_sent");
  });
});

describe("deriveCustomerWaitingSignal", () => {
  it("activates when last inbound is old", () => {
    const iso = "2026-05-01T08:00:00.000Z";
    const r = deriveCustomerWaitingSignal(iso, true, new Date("2026-05-01T12:00:00.000Z").getTime());
    expect(r.active).toBe(true);
    expect(r.severity).not.toBe("info");
  });
});
