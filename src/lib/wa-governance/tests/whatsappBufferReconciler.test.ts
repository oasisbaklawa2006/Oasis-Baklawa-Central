import { describe, expect, it } from "vitest";
import {
  BUFFER_IDLE_SECONDS,
  earliestCreatedAtBySender,
  latestCreatedAtBySender,
  normalizeSenderPhoneLast10,
  pickIdleSenders,
  to91FromSenderLast10,
} from "../../../../supabase/functions/_shared/whatsappBufferReconcilerPure";

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

  it("compares timestamptz values by epoch rather than lexical formatting", () => {
    const rows = [
      {
        id: "recent-offset",
        sender_phone: "9891162212",
        created_at: "2026-09-13T10:00:00.500123+00:00",
        bundle_status: "pending",
      },
      {
        id: "older-z",
        sender_phone: "9891162212",
        created_at: "2026-09-13T09:59:59.900Z",
        bundle_status: "pending",
      },
    ];

    const senderLatest = latestCreatedAtBySender(rows);
    expect(senderLatest.get("9891162212")).toBe("2026-09-13T10:00:00.500123+00:00");
    expect(pickIdleSenders(senderLatest, "2026-09-13T10:00:00.500Z")).toEqual([]);
  });

  it("tracks the earliest pending row so historical packets cannot authorize a newer flush", () => {
    const rows = [
      { id: "new-1", sender_phone: "9891162212", created_at: "2026-09-13T12:00:00.000Z", bundle_status: "pending" },
      { id: "new-2", sender_phone: "9891162212", created_at: "2026-09-13T12:00:10.000Z", bundle_status: "pending" },
    ];

    expect(earliestCreatedAtBySender(rows).get("9891162212")).toBe("2026-09-13T12:00:00.000Z");
  });

  it("documents governed buffer flush only after a packet in the pending-row window is set (no order writes)", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const dbSource = readFileSync(
      join(import.meta.dirname, "../../../../supabase/functions/_shared/whatsappBufferReconciler.ts"),
      "utf8",
    );
    expect(dbSource).toContain("senderHasStitchedPacket");
    expect(dbSource).toContain("earliestCreatedAtBySender");
    expect(dbSource).toContain('.gte("created_at", sinceIso)');
    expect(dbSource).toContain('bundle_status: "flushed"');
    expect(dbSource).not.toMatch(/\.from\(\s*["']orders["']\s*\)/);
    expect(dbSource).not.toMatch(/\.from\(\s*["']suggested_orders["']\s*\)/);
  });
});
