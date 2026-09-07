import { describe, expect, it } from "vitest";
import {
  formatWaPacketOutcome,
  operatorInboxPathForPacket,
  parseCrmCommunicationDeepLink,
} from "../crmCommunicationDeepLink";

const PACKET_ID = "a1b2c3d4-e5f6-4789-a012-3456789abcde";

describe("crmCommunicationDeepLink", () => {
  it("parses governed wa_packet outcome references", () => {
    const link = parseCrmCommunicationDeepLink(null, formatWaPacketOutcome(PACKET_ID));
    expect(link?.packetId).toBe(PACKET_ID);
    expect(link?.operatorInboxPath).toBe(operatorInboxPathForPacket(PACKET_ID));
  });

  it("parses bracketed packet references embedded in notes", () => {
    const link = parseCrmCommunicationDeepLink(`[WA_PACKET:${PACKET_ID}] follow-up`, null);
    expect(link?.packetId).toBe(PACKET_ID);
  });

  it("returns null when no governed packet reference exists", () => {
    expect(parseCrmCommunicationDeepLink("plain note", "delivered")).toBeNull();
  });
});
