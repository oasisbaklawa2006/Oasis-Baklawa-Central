import { describe, expect, it } from "vitest";
import {
  BUFFER_IDLE_SECONDS,
  latestCreatedAtBySender,
  normalizeSenderPhoneLast10,
  pickIdleSenders,
  to91FromSenderLast10,
} from "../../../../supabase/functions/_shared/whatsappBufferReconciler";

describe("whatsappBufferReconciler", () => {
  it("normalizes sender phones for governed contact lookup", () => {
    expect(normalizeSenderPhoneLast10("919891162212")).toBe("9891162212");
    expect(to91FromSenderLast10("9891162212")).toBe("919891162212");
    expect(BUFFER_IDLE_SECONDS).toBe(60);
  });

  it("only considers senders idle after the debounce window", () => {
    const rows = [
      { id: "a", sender_phone: "9891162212", created_at: "2026-09-13T10:00:00.000Z", bundle_status: "pending" },
      { id: "b", sender_phone: "9123456789", created_at: "2026-09-13T11:00:00.000Z", bundle_status: "pending" },
    ];
    const senderLatest = latestCreatedAtBySender(rows);
    const eligible = pickIdleSenders(senderLatest, "2026-09-13T10:01:00.000Z");
    expect(eligible).toEqual(["9891162212"]);
  });

  it("documents governed buffer flush only after packet_id is set (no order writes)", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const source = readFileSync(
      join(import.meta.dirname, "../../../../supabase/functions/_shared/whatsappBufferReconciler.ts"),
      "utf8",
    );
    expect(source).toContain("senderHasStitchedPacket");
    expect(source).toContain('bundle_status: "flushed"');
    expect(source).not.toMatch(/\.from\(\s*["']orders["']\s*\)/);
    expect(source).not.toMatch(/\.from\(\s*["']suggested_orders["']\s*\)/);
  });
});
