import { describe, expect, it } from "vitest";
import {
  formatCaptureProvenance,
  idempotencyMarker,
  parseCaptureProvenance,
  stripCaptureProvenance,
} from "../crmActionCaptureProvenance";

describe("crmActionCaptureProvenance", () => {
  it("formats and parses governed capture provenance", () => {
    const formatted = formatCaptureProvenance({
      channel: "call",
      source: "manual",
      deliveryState: "not_applicable",
      idempotencyKey: "idem-123",
      body: "Discussed pricing",
    });
    expect(formatted).toContain("[P62|channel=call|source=manual|delivery=not_applicable|idem=idem-123]");
    expect(formatted).toContain("Discussed pricing");

    const parsed = parseCaptureProvenance(formatted);
    expect(parsed.channel).toBe("call");
    expect(parsed.source).toBe("manual");
    expect(parsed.deliveryState).toBe("not_applicable");
    expect(parsed.idempotencyKey).toBe("idem-123");
    expect(parsed.body).toBe("Discussed pricing");
  });

  it("strips provenance for operator display", () => {
    const notes = formatCaptureProvenance({
      channel: "note",
      source: "manual",
      deliveryState: "not_applicable",
      idempotencyKey: "abc",
      body: "Internal note",
    });
    expect(stripCaptureProvenance(notes)).toBe("Internal note");
  });

  it("exposes stable idempotency marker for lookup", () => {
    expect(idempotencyMarker("key-1")).toBe("|idem=key-1");
  });
});
