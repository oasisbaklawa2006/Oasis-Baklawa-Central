import { describe, expect, it } from "vitest";
// Deliberately importing the Deno edge function's shared, pure grouping module by
// relative path (not duplicated) so the actual root-caused fix for the packet-
// stitching defect gets real, CI-run coverage. See
// supabase/functions/_shared/whatsappStitchingWindow.ts for why this file has no
// Deno-specific syntax and can be safely imported by both runtimes.
import {
  groupMessagesByStitchingWindow,
  isWithinAppendWindow,
  mergeStitchedText,
  partitionDuplicateProviderMessages,
  stitchedTextFor,
  type StitchableMessage,
} from "../../../../supabase/functions/_shared/whatsappStitchingWindow";

function msg(
  id: string,
  contactId: string,
  isoTime: string,
  content = `content-${id}`,
  providerMessageId?: string,
): StitchableMessage {
  return { id, contact_id: contactId, content, created_at: isoTime, provider_message_id: providerMessageId };
}

describe("groupMessagesByStitchingWindow", () => {
  it("groups a rapid burst of messages from one contact into a single group (Gate A/C: no split of one conversation)", () => {
    // Reproduces the physical scenario: 6 messages (including photos) sent by one
    // contact a few seconds apart. Prior to the fix, each message could land in its
    // own stitcher invocation and become its own single-fragment packet.
    const messages = [
      msg("m1", "contact-1", "2026-08-15T10:00:00Z"),
      msg("m2", "contact-1", "2026-08-15T10:00:03Z"),
      msg("m3", "contact-1", "2026-08-15T10:00:07Z"),
      msg("m4", "contact-1", "2026-08-15T10:00:11Z"),
      msg("m5", "contact-1", "2026-08-15T10:00:16Z"),
      msg("m6", "contact-1", "2026-08-15T10:00:22Z"),
    ];

    const [result] = groupMessagesByStitchingWindow(messages, 300);
    expect(result.contact_id).toBe("contact-1");
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].messages.map((m) => m.id)).toEqual(["m1", "m2", "m3", "m4", "m5", "m6"]);
    expect(result.groups[0].first_message_at).toBe("2026-08-15T10:00:00Z");
    expect(result.groups[0].last_message_at).toBe("2026-08-15T10:00:22Z");
  });

  it("never merges messages from two different senders into the same group (Gate C: customer isolation)", () => {
    const messages = [
      msg("a1", "contact-A", "2026-08-15T10:00:00Z"),
      msg("b1", "contact-B", "2026-08-15T10:00:01Z"),
      msg("a2", "contact-A", "2026-08-15T10:00:02Z"),
      msg("b2", "contact-B", "2026-08-15T10:00:03Z"),
    ];

    const results = groupMessagesByStitchingWindow(messages, 300);
    const byContact = new Map(results.map((r) => [r.contact_id, r]));

    expect(byContact.get("contact-A")?.groups).toHaveLength(1);
    expect(byContact.get("contact-A")?.groups[0].messages.map((m) => m.id)).toEqual(["a1", "a2"]);
    expect(byContact.get("contact-B")?.groups).toHaveLength(1);
    expect(byContact.get("contact-B")?.groups[0].messages.map((m) => m.id)).toEqual(["b1", "b2"]);
  });

  it("splits into a new group once the gap between messages exceeds the window (legitimately separate conversations)", () => {
    const messages = [
      msg("m1", "contact-1", "2026-08-15T10:00:00Z"),
      msg("m2", "contact-1", "2026-08-15T10:04:00Z"), // 240s later, within a 300s window
      msg("m3", "contact-1", "2026-08-15T11:00:00Z"), // far beyond window -> new group
    ];

    const [result] = groupMessagesByStitchingWindow(messages, 300);
    expect(result.groups).toHaveLength(2);
    expect(result.groups[0].messages.map((m) => m.id)).toEqual(["m1", "m2"]);
    expect(result.groups[1].messages.map((m) => m.id)).toEqual(["m3"]);
  });

  it("is idempotent/duplicate-safe at the grouping layer: re-processing the same input yields the same groups", () => {
    const messages = [
      msg("m1", "contact-1", "2026-08-15T10:00:00Z"),
      msg("m2", "contact-1", "2026-08-15T10:00:05Z"),
    ];
    const first = groupMessagesByStitchingWindow(messages, 300);
    const second = groupMessagesByStitchingWindow(messages, 300);
    expect(second).toEqual(first);
  });
});

describe("isWithinAppendWindow — decides whether a new fragment can extend an existing open packet", () => {
  it("is appendable when the new message arrives within the window after the packet's last fragment", () => {
    expect(isWithinAppendWindow("2026-08-15T10:00:00Z", "2026-08-15T10:04:00Z", 300)).toBe(true);
    expect(isWithinAppendWindow("2026-08-15T10:00:00Z", "2026-08-15T10:05:00Z", 300)).toBe(true);
  });

  it("is not appendable once the gap exceeds the window (starts a genuinely new packet)", () => {
    expect(isWithinAppendWindow("2026-08-15T10:00:00Z", "2026-08-15T10:05:01Z", 300)).toBe(false);
  });

  it("is not appendable for an out-of-order/delayed event timestamped before the packet's last fragment", () => {
    // A late-arriving webhook for an earlier message must never silently rewrite an
    // already-advanced packet window; it still gets accounted for via a new packet.
    expect(isWithinAppendWindow("2026-08-15T10:05:00Z", "2026-08-15T10:00:00Z", 300)).toBe(false);
  });
});

describe("stitchedTextFor / mergeStitchedText", () => {
  it("joins message contents and drops blanks", () => {
    expect(stitchedTextFor([{ content: "hi" }, { content: "" }, { content: "  there  " }])).toBe(
      "hi\nthere",
    );
  });

  it("merges new fragment text onto prior stitched text without losing it", () => {
    expect(mergeStitchedText("first message", [{ content: "second message" }])).toBe(
      "first message\nsecond message",
    );
  });

  it("handles an empty prior text gracefully", () => {
    expect(mergeStitchedText(null, [{ content: "only message" }])).toBe("only message");
    expect(mergeStitchedText(undefined, [{ content: "only message" }])).toBe("only message");
  });
});

describe("partitionDuplicateProviderMessages — Gate A: duplicate webhook / provider retry suppression", () => {
  it("treats the first occurrence of a provider_message_id as primary and later occurrences as duplicates", () => {
    const messages = [
      msg("m1", "contact-1", "2026-08-15T10:00:00Z", "hello", "wamid-1"),
      msg("m2", "contact-1", "2026-08-15T10:00:05Z", "hello", "wamid-1"), // retry of m1
      msg("m3", "contact-1", "2026-08-15T10:00:10Z", "another", "wamid-2"),
    ];

    const { primary, duplicates } = partitionDuplicateProviderMessages(messages);
    expect(primary.map((m) => m.id)).toEqual(["m1", "m3"]);
    expect(duplicates.map((m) => m.id)).toEqual(["m2"]);
  });

  it("never treats messages without a provider_message_id as duplicates of each other", () => {
    const messages = [
      msg("m1", "contact-1", "2026-08-15T10:00:00Z"),
      msg("m2", "contact-1", "2026-08-15T10:00:05Z"),
    ];
    const { primary, duplicates } = partitionDuplicateProviderMessages(messages);
    expect(primary.map((m) => m.id)).toEqual(["m1", "m2"]);
    expect(duplicates).toHaveLength(0);
  });

  it("handles more than two retries of the same provider_message_id", () => {
    const messages = [
      msg("m1", "contact-1", "2026-08-15T10:00:00Z", "x", "wamid-1"),
      msg("m2", "contact-1", "2026-08-15T10:00:01Z", "x", "wamid-1"),
      msg("m3", "contact-1", "2026-08-15T10:00:02Z", "x", "wamid-1"),
    ];
    const { primary, duplicates } = partitionDuplicateProviderMessages(messages);
    expect(primary.map((m) => m.id)).toEqual(["m1"]);
    expect(duplicates.map((m) => m.id)).toEqual(["m2", "m3"]);
  });
});
