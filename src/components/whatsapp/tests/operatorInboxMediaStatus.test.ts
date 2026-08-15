import { describe, expect, it } from "vitest";
import { deriveMessageMediaStatus, findEvidenceForMessage } from "@/components/whatsapp/operatorInboxUtils";
import type { GovernedEvidenceLink } from "@/components/whatsapp/operatorInboxPacketsLoader";

function evidence(overrides: Partial<GovernedEvidenceLink>): GovernedEvidenceLink {
  return {
    potential_order_id: "po-1",
    provider_message_id: "prov-1",
    evidence_kind: "IMAGE",
    media_count: 1,
    processing_state: "PENDING",
    ...overrides,
  };
}

describe("deriveMessageMediaStatus — Gate B: packet-scoped media presence/status, never a raw URL or global-only count", () => {
  it("returns 'none' when there is no governed evidence for this message", () => {
    expect(deriveMessageMediaStatus(null)).toBe("none");
    expect(deriveMessageMediaStatus(undefined)).toBe("none");
  });

  it("returns 'none' for a text-only message even if an evidence row exists", () => {
    expect(deriveMessageMediaStatus(evidence({ evidence_kind: "TEXT", media_count: 0 }))).toBe("none");
  });

  it("maps SUCCEEDED to 'available'", () => {
    expect(deriveMessageMediaStatus(evidence({ processing_state: "SUCCEEDED" }))).toBe("available");
  });

  it("maps PENDING and PROCESSING to 'processing' (must not silently disappear behind a global counter)", () => {
    expect(deriveMessageMediaStatus(evidence({ processing_state: "PENDING" }))).toBe("processing");
    expect(deriveMessageMediaStatus(evidence({ processing_state: "PROCESSING" }))).toBe("processing");
  });

  it("maps FAILED and TIMED_OUT to 'failed'", () => {
    expect(deriveMessageMediaStatus(evidence({ processing_state: "FAILED" }))).toBe("failed");
    expect(deriveMessageMediaStatus(evidence({ processing_state: "TIMED_OUT" }))).toBe("failed");
  });

  it("maps CORRUPT, UNREADABLE, and UNSUPPORTED to 'unreadable'", () => {
    expect(deriveMessageMediaStatus(evidence({ processing_state: "CORRUPT" }))).toBe("unreadable");
    expect(deriveMessageMediaStatus(evidence({ processing_state: "UNREADABLE" }))).toBe("unreadable");
    expect(deriveMessageMediaStatus(evidence({ processing_state: "UNSUPPORTED" }))).toBe("unreadable");
  });
});

describe("findEvidenceForMessage — packet-scoped lookup, not a global search", () => {
  const links: GovernedEvidenceLink[] = [
    evidence({ provider_message_id: "a", processing_state: "SUCCEEDED" }),
    evidence({ provider_message_id: "b", processing_state: "FAILED" }),
  ];

  it("finds the evidence row matching this message's provider_message_id", () => {
    expect(findEvidenceForMessage(links, "b")).toMatchObject({ processing_state: "FAILED" });
  });

  it("returns null when the message has no provider_message_id", () => {
    expect(findEvidenceForMessage(links, null)).toBeNull();
    expect(findEvidenceForMessage(links, undefined)).toBeNull();
  });

  it("returns null when no evidence row matches (never fabricates a status)", () => {
    expect(findEvidenceForMessage(links, "does-not-exist")).toBeNull();
  });
});
