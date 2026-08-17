import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { normalizeConclusion } from "../packetContentInterpretation";

const webhook = readFileSync("supabase/functions/whatsapp-webhook/index.ts", "utf8");

describe("WhatsApp AI payload and webhook hardening", () => {
  it("drops malformed nested AI entries before UI rendering", () => {
    const result = normalizeConclusion({
      intent: "NEW_ORDER",
      summary: "test",
      explicit_facts: [null, { provider_message_id: "p1", kind: "quantity", value: "5 kg" }],
      order_lines: [
        null,
        { product_name: "Pyramid", sku: "", quantity: 5, unit: "kg", status: "explicit", evidence_ids: ["p1"] },
        { product_name: "Bad", quantity: "not-a-number", status: "explicit", evidence_ids: [] },
      ],
      corrections: [42, { provider_message_id: "p2", supersedes: "5 kg", replacement: "8 kg" }],
      ambiguities: [null, "confirm delivery date"],
      recommended_action: "review",
      human_review_required: true,
    });

    expect(result?.explicit_facts).toHaveLength(1);
    expect(result?.order_lines).toHaveLength(1);
    expect(result?.order_lines[0]?.product_name).toBe("Pyramid");
    expect(result?.corrections).toHaveLength(1);
    expect(result?.ambiguities).toEqual(["confirm delivery date"]);
  });

  it("uses the deployed unique phone key for atomic contact upsert", () => {
    expect(webhook).toContain('.from("whatsapp_contacts")');
    expect(webhook).toContain('.upsert(');
    expect(webhook).toContain('{ onConflict: "phone_number" }');
    expect(webhook).toContain("WHATSAPP_CONTACT_PERSISTENCE_FAILED");
  });

  it("separates malformed JSON from retryable durable-capture failures", () => {
    expect(webhook).toContain('json({ ok: false, error: "Malformed webhook payload" }, 400)');
    expect(webhook).toContain('json({ ok: false, error: "Durable intake unavailable" }, 503)');
  });

  it("rejects empty or nonpositive provider timestamps", () => {
    expect(webhook).toContain('fields.timestampSec !== ""');
    expect(webhook).toContain("timestampSec > 0");
  });
});
