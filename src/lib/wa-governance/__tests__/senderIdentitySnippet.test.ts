import { describe, expect, it } from "vitest";
import { pickLatestInboundSnippetForIdentifySender } from "@/lib/wa-governance/senderIdentitySnippet";

describe("pickLatestInboundSnippetForIdentifySender", () => {
  it("uses the latest inbound non-empty message by created_at", () => {
    const snippet = pickLatestInboundSnippetForIdentifySender([
      {
        direction: "inbound",
        content: "older hello",
        created_at: "2026-06-01T10:00:00.000Z",
      },
      {
        direction: "outbound",
        content: "reply",
        created_at: "2026-06-01T10:05:00.000Z",
      },
      {
        direction: "inbound",
        content: "latest order please",
        created_at: "2026-06-01T11:00:00.000Z",
      },
    ]);
    expect(snippet).toBe("latest order please");
  });

  it("falls back to packet_sequence when created_at is missing", () => {
    const snippet = pickLatestInboundSnippetForIdentifySender([
      { direction: "inbound", content: "first", packet_sequence: 1 },
      { direction: "inbound", content: "last", packet_sequence: 3 },
      { direction: "inbound", content: "middle", packet_sequence: 2 },
    ]);
    expect(snippet).toBe("last");
  });

  it("falls back to stitched plain text when no inbound messages", () => {
    const snippet = pickLatestInboundSnippetForIdentifySender(
      [{ direction: "outbound", content: "operator reply" }],
      "stitched fallback text",
    );
    expect(snippet).toBe("stitched fallback text");
  });

  it("returns undefined when no inbound content or stitched text", () => {
    expect(pickLatestInboundSnippetForIdentifySender([], "")).toBeUndefined();
  });
});
